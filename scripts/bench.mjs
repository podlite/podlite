#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGES = join(ROOT, 'packages')
const REPORT = join(ROOT, 'bench-report.json')
const BASELINE = join(ROOT, 'bench-baseline.json')

// A slow run is only worth reporting against a number from before, so the
// report keeps the numbers and the baseline keeps the ones to compare with.
const args = process.argv.slice(2)
const saveBaseline = args.includes('--save-baseline')
const only = args.find(a => !a.startsWith('--'))

const collectFiles = () => {
  const found = []
  for (const pkg of readdirSync(PACKAGES)) {
    const dir = join(PACKAGES, pkg, 'bench')
    if (!existsSync(dir)) continue
    for (const file of readdirSync(dir).sort()) {
      if (file.endsWith('.bench.mjs')) found.push(join(dir, file))
    }
  }
  return found
}

const median = numbers => {
  const sorted = [...numbers].sort((a, b) => a - b)
  const middle = sorted.length >> 1
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

const measure = (run, rounds, warmup) => {
  for (let i = 0; i < warmup; i++) run()
  const times = []
  for (let i = 0; i < rounds; i++) {
    const started = process.hrtime.bigint()
    run()
    times.push(Number(process.hrtime.bigint() - started) / 1e6)
  }
  return { median: median(times), min: Math.min(...times), max: Math.max(...times) }
}

const round = value => Math.round(value * 1000) / 1000

const main = async () => {
  const files = collectFiles()
  if (files.length === 0) {
    console.error('bench: no packages/*/bench/*.bench.mjs found')
    process.exit(1)
  }

  const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : null
  const results = []

  for (const file of files) {
    const module = await import(pathToFileURL(file).href)
    const cases = module.default || []
    for (const item of cases) {
      if (only && !item.name.includes(only)) continue
      const { median: ms, min, max } = measure(item.run, item.rounds ?? 20, item.warmup ?? 3)
      const before = baseline?.cases?.[item.name]?.median
      results.push({
        name: item.name,
        file: relative(ROOT, file),
        median: round(ms),
        min: round(min),
        max: round(max),
        baseline: before ?? null,
        change: before ? round(((ms - before) / before) * 100) : null,
      })
    }
  }

  if (results.length === 0) {
    console.log(only ? `no case matches "${only}"` : 'no cases to run')
  }
  const width = Math.max(0, ...results.map(r => r.name.length))
  for (const r of results) {
    const change = r.change === null ? '' : `  ${r.change > 0 ? '+' : ''}${r.change}% of ${r.baseline} ms`
    console.log(
      `${r.name.padEnd(width)}  ${r.median.toFixed(3)} ms  (${r.min.toFixed(3)}–${r.max.toFixed(3)})${change}`,
    )
  }

  const report = {
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    cases: Object.fromEntries(results.map(r => [r.name, { median: r.median, min: r.min, max: r.max, file: r.file }])),
  }
  writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n')
  console.log(`\nwritten to ${relative(ROOT, REPORT)}`)

  if (saveBaseline) {
    writeFileSync(BASELINE, JSON.stringify(report, null, 2) + '\n')
    console.log(`baseline written to ${relative(ROOT, BASELINE)}`)
  }
}

main().catch(e => {
  console.error(`bench: ${e.message}`)
  process.exit(1)
})
