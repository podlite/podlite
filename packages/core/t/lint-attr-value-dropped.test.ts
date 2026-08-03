import { parseContent } from '../src/lint/loader'
import { attrValueDroppedRule, ATTR_VALUE_DROPPED_RULE_ID } from '../src/lint/rules/attr-value-dropped'
import { collectRecoveredErrors } from '../src/lint/rules/syntax-valid'
import type { LintContext } from '../src/lint/types'

const ctx: LintContext = { filePath: 'fake.podlite', fileType: 'podlite', config: {} }
const check = (src: string) => attrValueDroppedRule.check(parseContent(src, 'podlite'), ctx)

describe('attr-value-dropped rule', () => {
  it('exposes stable slug', () => {
    expect(ATTR_VALUE_DROPPED_RULE_ID).toBe('attr-value-dropped')
    expect(attrValueDroppedRule.id).toBe('attr-value-dropped')
  })

  it('flags a square-bracket list with its position', () => {
    const v = check('=for para :tags[a,b]\ntext\n')
    expect(v).toHaveLength(1)
    expect(v[0].severity).toBe('warning')
    expect(v[0].message).toContain('Square brackets')
    expect(v[0].location?.start.line).toBe(1)
    expect(v[0].location?.start.column).toBe(16)
  })

  it('flags bare text in parentheses', () => {
    const v = check('=for para :mime-type(text/csv)\ntext\n')
    expect(v).toHaveLength(1)
    expect(v[0].message).toContain('Bare text in parentheses')
  })

  it('reports every dropped value in the document', () => {
    expect(check('=for para :tags[a,b]\ntext\n\n=for para :k(spec)\nmore\n')).toHaveLength(2)
  })

  it('returns [] for a document with readable values', () => {
    expect(check('=for para :tags<a b> :k(42) :m{:a<x>}\ntext\n')).toEqual([])
  })

  it('leaves an unreadable directive line to syntax-valid', () => {
    const src = '=begin item text after the name\ninside\n=end item\n'
    expect(check(src)).toEqual([])
    expect(collectRecoveredErrors(parseContent(src, 'podlite')).length).toBeGreaterThan(0)
  })
})
