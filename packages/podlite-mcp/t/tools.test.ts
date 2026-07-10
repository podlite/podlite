import { parseSource, validateSource } from '../src/tools'

const validDoc = `=begin pod
=TITLE Notes

Plain paragraph
=end pod
`

const brokenDoc = `=begin pod
=begin table
a | b
=end pod
`

const nestedAngleDoc = `=begin pod
=for para :content-snippet<text B<bold> tail>
body
=end pod
`

describe('parseSource', () => {
  it('returns blocks with locations', () => {
    const ast = parseSource('=head1 Hello') as any[]
    expect(Array.isArray(ast)).toBe(true)
    expect(ast[0].name).toBe('head')
    expect(ast[0].location.start.line).toBe(1)
  })
})

describe('validateSource', () => {
  it('passes a valid document', () => {
    const report = validateSource(validDoc)
    expect(report.problems).toEqual([])
    expect(report.ok).toBe(true)
  })

  it('reports unbalanced delimited blocks', () => {
    const report = validateSource(brokenDoc)
    expect(report.ok).toBe(false)
    expect(report.problems.map(p => p.rule)).toContain('delimited-block-balance')
    expect(report.counts.error).toBeGreaterThan(0)
  })

  it('reports a nested angle inside an attribute value', () => {
    const report = validateSource(nestedAngleDoc)
    expect(report.ok).toBe(false)
    const rules = report.problems.map(p => p.rule)
    expect(rules).toContain('attr-nested-angle')
  })
})
