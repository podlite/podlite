import { parseContent } from '../src/lint/loader'
import { tableShapeRule, TABLE_SHAPE_RULE_ID } from '../src/lint/rules/table-shape'
import { attrValueDroppedRule } from '../src/lint/rules/attr-value-dropped'
import type { LintContext } from '../src/lint/types'

const ctx: LintContext = { filePath: 'fake.podlite', fileType: 'podlite', config: {} }
const check = (src: string) => tableShapeRule.check(parseContent(src, 'podlite'), ctx)

const structured = (cells: string[][]) =>
  [
    '=begin table',
    ...cells.map(row => ['=begin row', ...row.map(c => `=cell ${c}`), '=end row']).flat(),
    '=end table',
  ].join('\n') + '\n'

describe('table-shape rule', () => {
  it('exposes stable slug', () => {
    expect(TABLE_SHAPE_RULE_ID).toBe('table-shape')
    expect(tableShapeRule.id).toBe('table-shape')
  })

  it('flags a row padded to the table width', () => {
    const v = check(structured([['A', 'B', 'C'], ['1']]))
    expect(v).toHaveLength(1)
    expect(v[0].severity).toBe('warning')
    expect(v[0].message).toContain('1 of 3 cells')
    expect(v[0].location?.start.line).toBe(1)
  })

  it('flags a row whose extra cells were dropped', () => {
    const v = check(
      '=begin table\n=begin row :header\n=cell A\n=cell B\n=end row\n=begin row\n=cell 1\n=cell 2\n=cell 3\n=end row\n=end table\n',
    )
    expect(v).toHaveLength(1)
    expect(v[0].message).toContain('dropped 1')
  })

  it('flags a table that mixes separator styles', () => {
    const v = check('=begin table\n A | B\n ==|==\n 1   2\n=end table\n')
    expect(v.some(x => x.message.includes('separator styles'))).toBe(true)
  })

  it('returns [] for a table with even rows', () => {
    expect(
      check(
        structured([
          ['A', 'B'],
          ['1', '2'],
        ]),
      ),
    ).toEqual([])
  })

  it('leaves a dropped attribute value to attr-value-dropped', () => {
    const src = '=for para :tags[a,b]\ntext\n'
    expect(check(src)).toEqual([])
    expect(attrValueDroppedRule.check(parseContent(src, 'podlite'), ctx)).toHaveLength(1)
  })

  it('keeps table reports out of attr-value-dropped', () => {
    expect(attrValueDroppedRule.check(parseContent(structured([['A', 'B'], ['1']]), 'podlite'), ctx)).toEqual([])
  })
})
