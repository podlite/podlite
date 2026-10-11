#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGES = process.argv[2] ? resolve(process.argv[2]) : join(ROOT, 'packages')

function effectiveManifest(raw) {
  const { publishConfig, ...rest } = raw
  return { ...rest, ...(publishConfig ?? {}) }
}

// the files npm puts in the package, package.json among them whatever "files" says
function shippedFiles(dir) {
  const out = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: join(PACKAGES, dir),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return JSON.parse(out)[0].files.map(f => f.path)
}

const escapeRegExp = s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')

// Every * of a pattern target stands for the one text the * of its key matched,
// and that text may hold a slash
const patternMatches = (target, files) => {
  let first = true
  const source = target
    .slice(2)
    .split('*')
    .map(escapeRegExp)
    .reduce((acc, part) => {
      const star = first ? '(.+)' : '\\1'
      first = false
      return `${acc}${star}${part}`
    })
  const re = new RegExp(`^${source}$`)
  return files.some(f => re.test(f))
}

// targets of one export value, with the condition path and array position that lead to them
const targetsOf = (value, path = []) => {
  if (value === null) return []
  if (typeof value === 'string') return [{ path, target: value }]
  if (Array.isArray(value)) return value.flatMap((v, i) => targetsOf(v, [...path, `[${i}]`]))
  if (typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => targetsOf(v, [...path, k]))
  return []
}

function checkTargets(exp, files) {
  const errors = []
  for (const [key, value] of Object.entries(exp)) {
    for (const { path, target } of targetsOf(value)) {
      const where = path.length ? `"${key}" ${path.join('.').replace(/\.\[/g, '[')}` : `"${key}"`
      if (!target.startsWith('./')) {
        errors.push(`${where} target ${target} does not start with ./`)
        continue
      }
      const ships =
        key.includes('*') && target.includes('*') ? patternMatches(target, files) : files.includes(target.slice(2))
      if (!ships) errors.push(`${where} target ${target} is not in the package`)
    }
  }
  return errors
}

function checkPackage(dir) {
  const manifestPath = join(PACKAGES, dir, 'package.json')
  const raw = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (raw.private) return null
  const m = effectiveManifest(raw)
  const errors = []

  if (typeof m.types !== 'string') {
    errors.push('missing top-level "types"')
  }

  const exp = m.exports
  if (!exp || typeof exp !== 'object') {
    errors.push('missing "exports" map')
  } else {
    const root = exp['.']
    if (!root || typeof root !== 'object') {
      errors.push('missing "exports."."."')
    } else {
      const keys = Object.keys(root)
      if (!keys.includes('types')) {
        errors.push('"exports."."." missing "types" condition')
      } else if (keys[0] !== 'types') {
        errors.push('"types" condition must be first in "exports."."."')
      }
      if (!keys.includes('import') && !keys.includes('require') && !keys.includes('default')) {
        errors.push('"exports."."." missing runtime condition (import/require/default)')
      }
    }
  }

  if (!('sideEffects' in m)) {
    errors.push('missing explicit "sideEffects"')
  }

  if (exp && typeof exp === 'object') {
    errors.push(...checkTargets(exp, shippedFiles(dir)))
  }

  return { name: raw.name, dir, errors }
}

const packages = readdirSync(PACKAGES).filter(d => {
  try {
    return statSync(join(PACKAGES, d, 'package.json')).isFile()
  } catch {
    return false
  }
})

let failed = 0
const results = []
for (const dir of packages) {
  const r = checkPackage(dir)
  if (!r) continue
  results.push(r)
  if (r.errors.length) failed++
}

const pad = Math.max(...results.map(r => r.name.length))
for (const r of results) {
  const status = r.errors.length ? 'FAIL' : 'ok  '
  console.log(`${status}  ${r.name.padEnd(pad)}  ${r.errors.join('; ')}`)
}

if (failed) {
  console.error(`\n${failed} package(s) failed manifest hygiene check`)
  process.exit(1)
}
console.log(`\n${results.length} package(s) pass manifest hygiene check`)
