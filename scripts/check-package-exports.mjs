#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGES = join(ROOT, 'packages')

function effectiveManifest(raw) {
  const { publishConfig, ...rest } = raw
  return { ...rest, ...(publishConfig ?? {}) }
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
