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

  it('reads an unclosed angle in running text only to the end of its line', () => {
    const block = '=begin code :lang<bash>\nx\n=end code\n'
    expect(scanSourceRules(`=begin pod\n\nLook for C«:released-in<» and fail.\n\n${block}\n=end pod\n`)).toEqual([])
    expect(scanSourceRules(`=begin pod\n\nWrite :id< with no close.\n\n${block}\n=end pod\n`)).toEqual([])
  })

  it('ends an angle value with its line on the directive line', () => {
    expect(
      scanSourceRules('=begin pod\n\n=for para :a<x\n\n=begin code :lang<bash>\nx\n=end code\n\n=end pod\n'),
    ).toEqual([])
  })

  it('reads a line of content that starts with a colon or a quote as content', () => {
    expect(scanSourceRules('=for para :a<x>\n:b<y<z>> is written so.\n')).toEqual([])
    expect(scanSourceRules("=for para :a<x>\n'quoted' then :b<y<z>>\n")).toEqual([])
  })

  it('takes no colon inside a markup code or a quoted value for an attribute', () => {
    expect(scanSourceRules("=for para :caption('C«:a<x<y>>»')\nText\n")).toEqual([])
    expect(scanSourceRules('=for para :caption"see :a<x<y>>"\nText\n')).toEqual([])
    expect(scanSourceRules('=for para :caption｢see :a<x<y>>｣\nText\n')).toEqual([])
    expect(scanSourceRules("=config para\n= :caption('see :a<x<y>>')\n\n=para Text\n")).toEqual([])
    const v = scanSourceRules('=for item :a<x>\n  :b<y> C«:c<d<e>>»\n')
    expect(v.map(d => d.rule)).toEqual(['attr-continuation-dropped'])
  })

  it('reads a quoted value after text that holds an unclosed angle', () => {
    const src = "=begin pod\n\nLook for C«:released-in<».\n\n=for para :caption('see :a<x<y>>')\nText\n\n=end pod\n"
    expect(scanSourceRules(src)).toEqual([])
  })

  it('flags an option of a hash after the brace and after a comma', () => {
    expect(scanSourceRules('=for para :k{:a<x B<1> y>}\n')).toHaveLength(1)
    expect(scanSourceRules('=for para :k{:a(1),:b<x B<bold> tail>}\nText\n')).toHaveLength(1)
  })

  it('does not take the next option of a hash for a closing bracket', () => {
    expect(scanSourceRules('=for para :h{:a<x>, :b<z>}\nText\n')).toEqual([])
    expect(scanSourceRules('=for para :h{:a<x>, :c}\nText\n')).toEqual([])
    expect(scanSourceRules('=for para :h{:a<x>\f, :b<z>}\nText\n')).toEqual([])
    expect(scanSourceRules('=begin para :h{:a<x>,\n= :b<y>, :c<z>}\nText\n=end para\n')).toEqual([])
  })

  it('takes no brace inside a value for the brace of a hash', () => {
    expect(scanSourceRules('=for para :note<}> :h{:a<x>, :b<z>}\nText\n')).toEqual([])
    expect(scanSourceRules('=for para :note｢}｣ :h{:a<x>, :b<z>}\nText\n')).toEqual([])
    expect(scanSourceRules('=for para :h{:a<}>, :b<x>, :c<z>}\nText\n')).toEqual([])
    expect(scanSourceRules('=begin para :note<}>\n= :h{:a<x>, :b<z>}\nText\n=end para\n')).toEqual([])
  })

  it('still flags a > written after a closed value outside a hash', () => {
    for (const attrs of [':k<a> b>', ':k<a>, b>']) {
      const v = scanSourceRules(`=for para ${attrs}\nText\n`)
      expect(v.map(d => d.message)).toEqual([expect.stringContaining('contains a > that closes the attribute early')])
    }
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
