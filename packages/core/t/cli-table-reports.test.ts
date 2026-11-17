import { spawnSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

// what a table says about its source reaches the reader of the CLI: lint reports
// it under its rule, convert prints it next to the output it still writes

const bin = path.join(__dirname, '..', 'bin', 'podlite.js')

let dir: string
beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-cli-table-')))
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

type Violation = { rule: string; severity: string; message: string; location: { start: { line: number } } }
const violationsOf = (stdout: string): Violation[] => JSON.parse(stdout || '[]')

const run = (args: string[]) => {
  const result = spawnSync('node', [bin, ...args], { cwd: dir, encoding: 'utf-8' })
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}
const write = (body: string) => {
  fs.writeFileSync(path.join(dir, 'doc.podlite'), body)
  return 'doc.podlite'
}

const maybe = "=para text\n\n=begin data-table :mime-type('text/csv; header=maybe')\nname\nAda\n=end data-table\n"
// rectangular, so the old reading said nothing about it
const notCsv = '=begin data-table :mime-type(\'text/csv; header=present\')\nh,j\n"a"x,c\n=end data-table\n'
const short = '=begin table\nA | B | C\nx | y\n=end table\n'

describe('lint', () => {
  const lint = (body: string, strict = false) => {
    const r = run(['lint', write(body), '--format', 'json', ...(strict ? ['--strict'] : [])])
    return { status: r.status, violations: violationsOf(r.stdout) }
  }

  it('reports a header the norm does not know as an error of its own rule', () => {
    const r = lint(maybe)
    expect(r.violations.map(v => [v.rule, v.severity, v.location.start.line])).toEqual([
      ['table-header-invalid', 'error', 3],
    ])
    expect(r.violations[0].message).toMatch(/header=maybe is neither present nor absent/)
    expect(r.status).toBe(1)
  })

  it('keeps the header error when table-shape is switched off or muted', () => {
    fs.writeFileSync(path.join(dir, 'lint.json'), JSON.stringify({ rules: { 'table-shape': 'off' } }))
    const off = run(['lint', write(maybe), '--format', 'json', '--config', 'lint.json'])
    expect(violationsOf(off.stdout).map(v => [v.rule, v.severity])).toEqual([['table-header-invalid', 'error']])
    expect(off.status).toBe(1)
    const muted = maybe.replace('=begin data-table ', '=begin data-table :lint-ignore<table-shape> ')
    // the mute silences nothing there, and says so
    expect(lint(muted).violations.map(v => [v.rule, v.severity])).toEqual([
      ['table-header-invalid', 'error'],
      ['lint-ignore', 'warning'],
    ])
  })

  it('reports a source next to a body as an error of its own rule, which table-shape does not silence', () => {
    const conflict =
      '=begin data :key<d> :mime-type<text/csv>\nh\nv\n=end data\n\n=begin data-table :src<data:d>\n\n=end data-table\n'
    const r = lint(conflict)
    expect(r.violations.map(v => [v.rule, v.severity, v.location.start.line])).toEqual([
      ['table-source-conflict', 'error', 6],
    ])
    expect(r.status).toBe(1)
    fs.writeFileSync(path.join(dir, 'lint.json'), JSON.stringify({ rules: { 'table-shape': 'off' } }))
    const off = run(['lint', write(conflict), '--format', 'json', '--config', 'lint.json'])
    expect(violationsOf(off.stdout).map(v => v.rule)).toEqual(['table-source-conflict'])
  })

  it('reports content that is not CSV as a warning, and only that', () => {
    const r = lint(notCsv)
    expect(r.violations.map(v => [v.rule, v.severity])).toEqual([['table-shape', 'warning']])
    expect(r.violations[0].message).toMatch(/is not CSV/)
    expect(r.status).toBe(0)
    expect(lint(notCsv, true).status).toBe(1)
  })

  it('still reports a padded row as a warning', () => {
    expect(lint(short).violations.map(v => v.severity)).toEqual(['warning'])
  })
})

describe('convert', () => {
  const convert = (body: string) => run(['convert', write(body), '--to', 'html', '-o', '-'])

  it('writes the table read with the default and prints the header error', () => {
    const r = convert(maybe)
    expect(r.stdout).toContain('<thead>')
    expect(r.stderr.trim().split('\n')).toEqual([
      expect.stringMatching(
        /^podlite convert: doc\.podlite:3: error: =data-table: header=maybe is neither present nor absent/,
      ),
    ])
    expect(r.status).toBe(0)
  })

  it('writes content that is not CSV as code and prints one warning', () => {
    const r = convert(notCsv)
    expect(r.stdout).toContain('<code')
    expect(r.stdout).not.toContain('<table')
    expect(r.stderr.trim().split('\n')).toEqual([
      expect.stringMatching(/^podlite convert: doc\.podlite:1: warning: .*is not CSV/),
    ])
    expect(r.status).toBe(0)
  })

  it('prints a padded row too', () => {
    expect(convert(short).stderr).toMatch(/^podlite convert: doc\.podlite:1: warning: table row 2 has 2 of 3 cells/)
  })
})
