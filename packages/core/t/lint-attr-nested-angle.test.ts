import * as path from 'path'
import { runLint } from '../src/lint'
import { scanSourceRules, ATTR_NESTED_ANGLE_RULE_ID, attrNestedAngleRule } from '../src/lint/grammar/scan'

const FIXTURES = path.join(__dirname, 'lint-fixtures')

describe('attr-nested-angle rule', () => {
  it('exposes stable slug and error severity', () => {
    expect(ATTR_NESTED_ANGLE_RULE_ID).toBe('attr-nested-angle')
    expect(attrNestedAngleRule.id).toBe('attr-nested-angle')
    expect(attrNestedAngleRule.severity).toBe('error')
  })

  it('flags a nested formatting code inside an angle-delimited value', () => {
    const v = scanSourceRules('=for para :content-snippet<text B<bold> tail>')
    expect(v).toHaveLength(1)
    expect(v[0].rule).toBe('attr-nested-angle')
    expect(v[0].severity).toBe('error')
    expect(v[0].location?.start.line).toBe(1)
    expect(v[0].location?.start.column).toBe(11)
  })

  it('flags a bare nested angle without a formatting-code letter', () => {
    const v = scanSourceRules('=for para :summary<has < and > inside>')
    expect(v).toHaveLength(1)
  })

  it('skips multi-angle escape', () => {
    const v = scanSourceRules('=for para :content-snippet<<text B<bold> tail>>')
    expect(v).toEqual([])
  })

  it('skips guillemet delimiters', () => {
    const v = scanSourceRules('=for para :content-snippet«text B<bold> tail»')
    expect(v).toEqual([])
  })

  it('skips parenthesis-quoted delimiters', () => {
    const v = scanSourceRules("=for para :content-snippet('text B<bold> tail')")
    expect(v).toEqual([])
  })

  it('skips a plain text value', () => {
    expect(scanSourceRules('=for para :title<just plain text>')).toEqual([])
  })

  it('skips an empty attribute', () => {
    expect(scanSourceRules('=for para :title<>')).toEqual([])
  })

  it('flags every offending attribute in a file', () => {
    const src = '=for para :a<x B<1> y>\n=  :b<x I<2> y>\n=  :c<plain>\n'
    const v = scanSourceRules(src)
    expect(v).toHaveLength(2)
    expect(v[0].location?.start.line).toBe(1)
    expect(v[1].location?.start.line).toBe(2)
  })

  it('reports column for second occurrence on the same line', () => {
    const src = '=for para :a<x B<1> y> :c<plain> :b<x I<2> y>'
    const v = scanSourceRules(src)
    expect(v).toHaveLength(2)
    expect(v[0].location?.start.column).toBe(11)
    expect(v[1].location?.start.column).toBeGreaterThan(30)
  })

  it('returns [] for empty content', () => {
    expect(scanSourceRules('')).toEqual([])
  })

  it('flags a value closed early by a > written inside it', () => {
    const v = scanSourceRules('=for para :snippet<curiosity preference > anxiety preference. more>')
    expect(v).toHaveLength(1)
    expect(v[0].message).toContain('contains a > that closes the attribute early')
  })

  it('does not take the next attribute for a closing bracket', () => {
    expect(scanSourceRules('=for para :a<x> :b<y>')).toEqual([])
  })

  it('stays out of running text and out of verbatim blocks', () => {
    expect(scanSourceRules('Example: C<:status<accepted>> and C<:status<draft>>\n')).toEqual([])
    expect(scanSourceRules('=begin code\n=for para :k<a<b>>\n=end code\n')).toEqual([])
  })
})

describe('runLint attr-nested-angle integration', () => {
  let stdout: jest.SpyInstance

  beforeEach(() => {
    stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })
  afterEach(() => {
    stdout.mockRestore()
  })

  it('broken fixture → exit 1 with error emitted', () => {
    const code = runLint([path.join(FIXTURES, 'attr-nested-broken.podlite')], { strict: false, format: 'text' })
    expect(code).toBe(1)
    const out = stdout.mock.calls.map(c => c[0]).join('')
    expect(out).toMatch(/error: attribute value contains a nested.*\(attr-nested-angle\)/)
  })

  it('clean fixture → exit 0', () => {
    const code = runLint([path.join(FIXTURES, 'attr-nested-clean.podlite')], { strict: false, format: 'text' })
    expect(code).toBe(0)
  })
})
