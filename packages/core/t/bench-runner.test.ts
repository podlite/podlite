import * as fs from 'fs'
import * as path from 'path'
import { execFileSync } from 'child_process'

const root = path.join(__dirname, '..', '..', '..')
const runner = path.join(root, 'scripts', 'bench.mjs')
const report = path.join(root, 'bench-report.json')

// one short case keeps the check to a second; the point is that the command
// runs end to end and leaves numbers behind, not how fast the parser is
const runBench = (filter: string) => execFileSync('node', [runner, filter], { encoding: 'utf-8', cwd: root })

describe('the bench command', () => {
  it('prints a number for every case it ran', () => {
    const out = runBench('render to markdown')
    expect(out).toMatch(/schema: render to markdown\s+\d+\.\d+ ms/)
  })

  it('leaves the numbers in a report', () => {
    runBench('render to markdown')
    expect(fs.existsSync(report)).toBe(true)
    const written = JSON.parse(fs.readFileSync(report, 'utf-8'))
    expect(written.node).toBe(process.version)
    const cases = Object.keys(written.cases)
    expect(cases).toContain('schema: render to markdown')
    expect(typeof written.cases[cases[0]].median).toBe('number')
  })

  it('finds the cases of every package that holds them', () => {
    const dirs = fs
      .readdirSync(path.join(root, 'packages'))
      .filter(pkg => fs.existsSync(path.join(root, 'packages', pkg, 'bench')))
    expect(dirs.sort()).toEqual(['core', 'podlite-schema'])
  })

  it('says so when the name matches nothing', () => {
    const out = runBench('no such case')
    expect(out).toContain('no case matches "no such case"')
  })
})
