import type { PodliteDocument } from '@podlite/schema'
import { lintSource } from '../src/lint'
import { runRules } from '../src/lint/engine'
import { DEFAULT_RULES } from '../src/lint/rules'
import { TABLE_COLUMN_WIDTH_RULE_ID, tableColumnWidthRule } from '../src/lint/rules/table-column-width'
import type { LintContext } from '../src/lint/types'

const rules = (src: string) => lintSource(src, 'x.podlite', {}).violations.map(v => v.rule)
const said = (src: string) => rules(src).filter(rule => rule === TABLE_COLUMN_WIDTH_RULE_ID)

const table = (rows: string[]) => `=begin table\n${rows.join('\n')}\n=end table\n`

describe('table-column-width rule', () => {
  it('exposes stable slug and warning severity', () => {
    expect(TABLE_COLUMN_WIDTH_RULE_ID).toBe('table-column-width')
    expect(tableColumnWidthRule.severity).toBe('warning')
  })

  it('says nothing when a row draws its bar off the place of the separator bar', () => {
    expect(said(table(['A | B', '==+==', 'longer | z']))).toEqual([])
  })

  it('says nothing when a row held apart by spaces fills the place of a separator bar', () => {
    expect(said(table(['  VERSIONING   DATE', '  =======|========', '  0.1          2026-08-12']))).toEqual([])
  })

  it('says nothing when rows on several lines line up their bars and the separator does not', () => {
    expect(said(table(['Alpha | B', '==+======', 'bravo | c', 'delta | z', '', 'omega | q']))).toEqual([])
  })

  it('says nothing about a table written as an example inside a code block', () => {
    expect(
      said(`=begin code :lang<podlite>\n${table([' Name  | Value', ' =====|=========', ' longcell| two'])}=end code\n`),
    ).toEqual([])
  })

  it('leaves a bar written without a space before it to the report of the padded row', () => {
    const found = rules(table([' Name  | Value', ' =====|=========', ' longcell| two']))
    expect(found).not.toContain(TABLE_COLUMN_WIDTH_RULE_ID)
    expect(found).toContain('table-shape')
  })

  // the parser does not give this code yet, so a tree is built from its JSON form
  const treeWith = (diagnostics: object[]): PodliteDocument =>
    JSON.parse(JSON.stringify({ type: 'block', name: 'root', margin: '', content: [], diagnostics }))
  const location = { start: { line: 2, column: 3, offset: 6 }, end: { line: 4, column: 1, offset: 30 } }
  const ctx = (rules: Record<string, 'off' | 'warning' | 'error'> = {}): LintContext => ({
    filePath: 'x.podlite',
    fileType: 'podlite',
    config: { rules },
  })

  it('passes on what the parser reports under its name, as reported', () => {
    const ast = treeWith([
      { severity: 'warning', code: 'table-row-cells', message: 'a row', location },
      { severity: 'error', code: 'table-column-width', message: 'columns merged', location },
      { severity: 'warning', code: 'table-column-width', message: 'no place' },
    ])
    expect(tableColumnWidthRule.check(ast, ctx())).toEqual([
      { rule: 'table-column-width', severity: 'error', message: 'columns merged', location },
      { rule: 'table-column-width', severity: 'warning', message: 'no place', location: undefined },
    ])
  })

  it('runs among the default rules and follows the setting of its name', () => {
    const ast = treeWith([{ severity: 'warning', code: 'table-column-width', message: 'columns merged', location }])
    const of = (rules: Record<string, 'off' | 'warning' | 'error'>) =>
      runRules(ast, DEFAULT_RULES, ctx(rules))
        .filter(v => v.rule === TABLE_COLUMN_WIDTH_RULE_ID)
        .map(v => v.severity)
    expect(of({})).toEqual(['warning'])
    expect(of({ 'table-column-width': 'error' })).toEqual(['error'])
    expect(of({ 'table-column-width': 'off' })).toEqual([])
  })

  it('leaves a mute of its name with nothing to silence on a table split by its own bars', () => {
    const src = '=begin table :lint-ignore<table-column-width>\nA | B\n==+==\nlonger | z\n=end table\n'
    const report = lintSource(src, 'x.podlite', {})
    expect(report.violations.map(v => v.message)).toEqual([':lint-ignore<table-column-width> silenced nothing here'])
  })
})
