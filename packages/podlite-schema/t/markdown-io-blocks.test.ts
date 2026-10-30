import { podlitePluggable } from '../src/pluggableParser'

// the parser of this package, so a run against its earlier source reads that source
const p = podlitePluggable()
const markdown = (doc: string) => String(p.toMarkdown(p.toAst(p.parse(doc, { podMode: 1 }))))
const html = (doc: string) => String(p.toHtml(p.toAst(p.parse(doc, { podMode: 1 }))))

const inCell = (block: string) =>
  `=begin table\n=begin row\n=cell Header\n=cell Other\n=end row\n=begin row\n=begin cell\n${block}\n=end cell\n=cell Tail\n=end row\n=end table\n`

describe('input and output blocks in markdown output', () => {
  it('writes a sample as one fence a reader keeps as written', () => {
    expect(markdown('=begin input\nsay <Audit Title>\nline two\n=end input\n')).toBe(
      '```\nsay <Audit Title>\nline two\n```\n',
    )
  })

  it('keeps the leading spaces of a line', () => {
    expect(markdown('=begin output\nok <x>\n  indented\n=end output\n')).toBe('```\nok <x>\n  indented\n```\n')
  })

  it('closes a sample of one line with or without a final line break', () => {
    expect(markdown('=output single line\n')).toBe('```\nsingle line\n```\n')
    expect(markdown('=output single line')).toBe('```\nsingle line\n```\n')
  })

  it('keeps an empty line inside the fence', () => {
    expect(markdown('=begin input\na\n\nb\n=end input\n')).toBe('```\na\n\nb\n```\n')
  })

  it('writes markdown signs and character references of the sample as they stand', () => {
    expect(markdown('=output a_b *x* [y] &copy;\n')).toBe('```\na_b *x* [y] &copy;\n```\n')
    expect(markdown('=input E<lt> E<amp>\n')).toBe('```\n< &\n```\n')
    expect(markdown('=output E<lt> E<amp>\n')).toBe('```\n< &\n```\n')
  })

  it('makes the fence longer than a run of backticks inside the sample', () => {
    expect(markdown('=begin input\nbefore\n```\nafter\n=end input\n')).toBe('````\nbefore\n```\nafter\n````\n')
  })

  it('writes a markup code inside the fence as its markdown, which the reader shows as written', () => {
    expect(markdown('=begin input\n$ K<ls> -l\n=end input\n')).toBe('```\n$ `ls` -l\n```\n')
  })

  it('writes an empty sample as an empty fence', () => {
    expect(markdown('=begin input\n=end input\n')).toBe('```\n```\n')
  })

  it('opens the fence on a line of its own', () => {
    expect(markdown('=begin item\n=begin input\n<Audit Title>\n=end input\n=end item\n')).toBe(
      '- \n```\n<Audit Title>\n```\n',
    )
    expect(markdown('=begin defn\nTERM\n=begin input\n<Audit Title>\n=end input\n=end defn\n')).toContain(
      '**TERM:** \n```\n<Audit Title>\n```\n',
    )
  })

  it('hides the text of a masked sample', () => {
    expect(markdown('=for input :masked\nsecret K<word> E<lt>\n')).toBe('```\n██████ `████` █\n```\n')
    expect(markdown('=begin pod :masked\n=input secret\n=end pod\n')).toBe('```\n██████\n```\n')
  })
})

describe('a sample where a fence does not hold', () => {
  it('writes a sample inside a quote as text', () => {
    expect(markdown('=begin input :nested(2)\n<Audit Title>\nsecond\n=end input\n')).toBe(
      '> > \\<Audit Title>\nsecond\n\n',
    )
    expect(markdown('=begin nested\n=input K<ls> -l\n=end nested\n')).toBe('> `ls` -l\n\n')
  })

  it('writes a sample after a paragraph of the quote as text', () => {
    expect(markdown('=begin nested\nFirst\n\n=input <Before>\n=end nested\n')).toBe('> First\n\n\\<Before>\n\n')
  })

  it('writes a sample after the quote closes as a fence', () => {
    expect(markdown('=begin nested\n=input <Before>\n=end nested\n\n=output <After>\n')).toBe(
      '> \\<Before>\n\n```\n<After>\n```\n',
    )
    const twoLevels =
      '=begin nested\n=begin nested\n=input <Deep>\n=end nested\n=input <Mid>\n=end nested\n\n=output <After>\n'
    const out = markdown(twoLevels)
    expect(out).toContain('\\<Mid>')
    expect(out).toContain('```\n<After>\n```\n')
    expect(out.match(/```/g)).toHaveLength(2)
  })

  it('hides the text of a masked sample inside a quote', () => {
    expect(markdown('=begin nested\n=for input :masked\nsecret K<word> E<lt>\n=end nested\n')).toBe(
      '> ██████ `████` █\n\n',
    )
  })

  it('writes a table whose cell holds a sample as a frame with the sample in a fence', () => {
    expect(markdown(inCell('=output a | b'))).toContain('<td>\n\n```\na | b\n```\n\n</td>\n<td>\n\nTail\n\n</td>')
    expect(markdown(inCell('=output a \\| b'))).toContain('```\na \\| b\n```')
  })

  it('writes a sample after a table inside the same cell as a fence', () => {
    const doc =
      '=begin table\n=begin row\n=cell Header\n=end row\n=begin row\n=begin cell\n=begin table\n=begin row\n=cell inner\n=end row\n=end table\n=output <Out>\n=end cell\n=end row\n=end table\n'
    expect(markdown(doc)).toContain('```\n<Out>\n```')
  })
})

describe('what stays as it was', () => {
  it('writes a code block as before', () => {
    expect(markdown('=begin code\nfirst\nsecond\n=end code\n')).toBe('```\nfirst\nsecond\n```\n')
  })

  it('writes a quote of one paragraph as before', () => {
    expect(markdown('=begin nested\nPara one\n=end nested\n')).toBe('> Para one\n\n')
  })

  it('writes a sample in a cell of merged cells as a fence', () => {
    const doc = '=begin table\n=begin row\n=begin cell :colspan<2>\n=output <a> & b\n=end cell\n=end row\n=end table\n'
    expect(markdown(doc)).toContain('```\n<a> & b\n```')
  })

  it('keeps the HTML output of a sample', () => {
    expect(html('=begin input\nsay <x>\n=end input\n')).toContain('<blockquote><pre><kbd>say &lt;x&gt;')
  })
})
