import { parseSource, querySource, renderReport, renderSource, validateSource } from '../src/tools'

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

describe('includes with the files the caller gives', () => {
  const doc = '=begin pod\n=head1 Doc\n\n=include file:part.podlite\n\n=para after\n=end pod\n'
  const part = '=begin pod\n=head2 Part\n\nPart text.\n=end pod\n'

  it('renders the blocks of an included file and not its address', () => {
    const report = renderReport(doc, 'md', { 'part.podlite': part })
    expect(report.output).toContain('## Part')
    expect(report.output).not.toContain('file:part.podlite')
    expect([report.problems, report.error, report.notes]).toEqual([[], false, ['included from files: part.podlite']])
  })

  it('leaves an include in place without files and names the path it asks for', () => {
    const report = renderReport(doc, 'md')
    expect(report.output).toContain('file:part.podlite')
    expect([report.problems, report.error, report.notes]).toEqual([
      ['files were not given; includes not assembled: part.podlite'],
      false,
      [],
    ])
  })

  it('names a mask it asks for without files', () => {
    const report = renderReport('=begin pod\n=include file:chapters/*.podlite\n=end pod\n', 'md')
    expect(report.problems).toEqual(['files were not given; includes not assembled: chapters/*.podlite'])
  })

  it('reports a missing file of an empty set as an error at its directive', () => {
    const report = renderReport(doc, 'md', {})
    expect([report.error, report.problems]).toEqual([true, ['input.podlite:4: include target not found: part.podlite']])
  })

  it('refuses a file under the name of the document itself', () => {
    expect(() => renderReport(doc, 'md', { './input.podlite': part })).toThrow(/input.podlite/)
    expect(() => renderReport(doc, 'md', { 'x/../input.podlite': part })).toThrow(/input.podlite/)
    expect(() => validateSource(doc, { 'input.podlite': part })).toThrow(/input.podlite/)
  })

  it('names a file only when a block of it is in the document', () => {
    const selected = '=begin pod\n=include file:part.podlite | head2\n=end pod\n'
    const report = renderReport(selected, 'md', { 'part.podlite': '=begin pod\n=head1 Present\n=end pod\n' })
    expect([report.output.trim(), report.notes]).toEqual(['', []])
  })

  it('still gives a string from renderSource', () => {
    expect(typeof renderSource(doc, 'md', { 'part.podlite': part })).toBe('string')
  })

  it('assembles a nested include and an included Markdown file', () => {
    const files = {
      'part.podlite': '=begin pod\n=include file:notes/more.md\n=end pod\n',
      'notes/more.md': '# More\n\nFrom Markdown.\n',
    }
    const report = renderReport(doc, 'md', files)
    expect(report.output).toContain('From Markdown.')
    expect(report.notes).toEqual(['included from files: part.podlite, notes/more.md'])
  })

  it('reports an include by a document name as a warning, not an error', () => {
    const report = renderReport('=begin pod\n=include doc:Other\n=end pod\n', 'md', {})
    expect(report.error).toBe(false)
    expect(report.problems.length).toBe(1)
  })

  it('finds a block of an included file and gives it as that file holds it', () => {
    const report = querySource('head2', doc, 'podlite', { 'part.podlite': part })
    expect([report.matchCount, report.output]).toEqual([1, '=head2 Part'])
  })

  it('gives a block of a Markdown section of an included file as its Markdown', () => {
    const section = '=begin pod\n=begin markdown\n# Title\n\nMd text.\n=end markdown\n=end pod\n'
    const report = querySource('para', doc, 'podlite', { 'part.podlite': section })
    expect(report.output).toContain('Md text.')
  })

  it('finds no include directive once the include is assembled, and finds it without files', () => {
    expect(querySource('include', doc, 'podlite', { 'part.podlite': part }).matchCount).toBe(0)
    expect(querySource('include', doc, 'podlite').matchCount).toBe(1)
  })

  it('validates an include against the files given', () => {
    const clean = validateSource(doc, { 'part.podlite': part })
    const missing = validateSource(doc, { 'other.podlite': part })
    expect([clean.ok, clean.problems]).toEqual([true, []])
    expect([missing.ok, missing.problems.map(p => [p.rule, p.severity, p.location?.start.line])]).toEqual([
      false,
      [['include-resolves', 'error', 4]],
    ])
  })

  it('names the includes it did not check when no files are given', () => {
    const report = validateSource(doc)
    expect([report.ok, report.counts, report.problems.map(p => [p.severity, p.message])]).toEqual([
      true,
      { error: 0, warning: 0, info: 1 },
      [['info', 'files were not given; includes not checked: part.podlite']],
    ])
  })
})
