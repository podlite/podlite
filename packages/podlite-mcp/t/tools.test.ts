import { parseSource, querySource, renderSource, validateSource } from '../src/tools'

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

describe('renderSource', () => {
  const doc = `=begin pod
=head1 Introduction

First B<paragraph>
=end pod
`

  it('renders html', () => {
    const html = renderSource(doc, 'html')
    expect(html).toContain('Introduction')
    expect(html).toMatch(/<h1[\s>]/)
    expect(html).toContain('<strong>paragraph</strong>')
  })

  it('renders markdown', () => {
    const md = renderSource(doc, 'md')
    expect(md).toContain('# Introduction')
    expect(md).toContain('**paragraph**')
  })
})

describe('querySource', () => {
  const doc = `=begin pod
=head1 First

=begin code :lang<js>
const x = 1
=end code

=head1 Second

=head2 Nested
=end pod
`

  it('selects blocks by name', () => {
    const report = querySource('head1', doc, 'podlite')
    expect(report.matchCount).toBe(2)
    expect(report.output).toContain('=head1 First')
    expect(report.output).toContain('=head1 Second')
    expect(report.output).not.toContain('Nested')
  })

  it('selects by attribute predicate', () => {
    const report = querySource('code[:lang<js>]', doc, 'json')
    expect(report.matchCount).toBe(1)
    const blocks = JSON.parse(report.output)
    expect(blocks[0].name).toBe('code')
  })

  it('returns zero matches without error', () => {
    const report = querySource('formula', doc, 'podlite')
    expect(report.matchCount).toBe(0)
    expect(report.output).toBe('')
  })

  it('rejects an invalid selector', () => {
    expect(() => querySource('[[', doc, 'podlite')).toThrow('Invalid selector')
  })

  const section = '=pod\n\n=begin markdown\n# Title\n\nMd text.\n=end markdown\n'

  it('finds the blocks of a Markdown section and gives them as Markdown', () => {
    const para = querySource('para', section, 'podlite')
    expect([para.matchCount, para.output]).toEqual([1, 'Md text.'])
  })

  it('gives in json a block of a section the place of the section, without a file', () => {
    const [head] = JSON.parse(querySource('head1', section, 'json').output)
    expect([head.precision, head.location.start.line, 'file' in head]).toEqual(['section', 3, false])
  })

  it('does not count the root inside a section as found', () => {
    const names = JSON.parse(querySource('*', section, 'json').output).map((b: { name: string }) => b.name)
    expect(names).toEqual(['pod', 'markdown', 'head'])
  })
})

describe('querySource with a source in the selector', () => {
  it('throws when the source does not resolve, which the tool reports as an error', () => {
    expect(() => querySource('file:x.podlite | para', '=pod\n\nText.\n', 'podlite')).toThrow(
      /the source does not resolve: file:x.podlite/,
    )
  })

  it('finds the text given under the name the tool gives it', () => {
    expect(querySource('file:input.podlite | para', '=pod\n\nText.\n', 'podlite').matchCount).toBe(1)
  })
})
