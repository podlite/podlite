import { execFileSync } from 'child_process'
import { createHash } from 'crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { podliteGrammar } from '../src'

const here = __dirname
const { quickstart, cases } = JSON.parse(readFileSync(join(here, 'fixtures', 'cases.json'), 'utf8'))

type Report = {
  cases: Record<string, string[]>
  engines: Record<string, boolean>
  colours: Record<
    string,
    {
      directive: string
      name: string
      attribute: string
      value: string[]
      cell: { color: string; fontStyle: number; fg: string }
      separator: string[]
    }
  >
}

// The grammar under test is the one in src, written out the way the build writes it;
// shiki runs in a plain node process, because jest cannot load its modules
let report: Report
beforeAll(() => {
  const dir = mkdtempSync(join(tmpdir(), 'podlite-textmate-'))
  try {
    const file = join(dir, 'podlite.tmLanguage.json')
    writeFileSync(file, JSON.stringify(podliteGrammar))
    report = JSON.parse(
      execFileSync('node', [join(here, 'check.mjs'), file], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }),
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}, 120_000)

it('the tutorial sample is the one the plan names', () => {
  const bytes = readFileSync(join(here, 'fixtures', quickstart))
  expect(bytes.length).toBe(423)
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(
    '855ffcb6f6da3459647db40f31fc49758737e450e163a4ed728d8ff505d7e954',
  )
})

describe('scopes on named pieces of text', () => {
  it.each(cases.map((c: { id: string }) => c.id))('%s', (id: string) => {
    expect(report.cases[id]).toEqual([])
  })
})

describe('the JavaScript regex engine of shiki gives the same tokens as Oniguruma', () => {
  it.each(cases.map((c: { id: string }) => c.id))('%s', (id: string) => {
    expect(report.engines[id]).toBe(true)
  })
})

describe.each(['one-light', 'github-dark'])('the tutorial sample in %s', theme => {
  it('shows the directive, the block name and the attribute name in three colours', () => {
    const { directive, name, attribute } = report.colours[theme]
    expect(new Set([directive, name, attribute]).size).toBe(3)
  })

  it('leaves a table cell in the plain text colour and the value and separators scoped', () => {
    const { cell, value, separator } = report.colours[theme]
    expect(cell.color.toLowerCase()).toBe(cell.fg.toLowerCase())
    expect(cell.fontStyle).toBe(0)
    expect(value).toContain('string.unquoted.podlite')
    expect(separator).toContain('punctuation.separator.table.podlite')
  })
})
