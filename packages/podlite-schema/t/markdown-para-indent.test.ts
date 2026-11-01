import { podlitePluggable } from '../src/pluggableParser'
import { toMarkdown } from '../src'
import Writer from '../src/writer'

// the parser of this package, so a run against its earlier source reads that source
const p = podlitePluggable()
const tree = (doc: string) => p.toAst(p.parse(doc, { podMode: 1 }))
const markdown = (doc: string) => String(p.toMarkdown(tree(doc)))

describe('the indent of a paragraph in markdown output', () => {
  it('writes the first line of a paragraph without its indent', () => {
    expect(markdown('=para\n    B<bold> <div> &copy;\n')).toBe('**bold** \\<div> \\&copy;\n\n')
    expect(markdown('=for para\n    four spaces\n')).toBe('four spaces\n\n')
    expect(markdown('=para\n\t\ttabbed\n')).toBe('tabbed\n\n')
  })

  it('writes the first line without its indent inside a quote', () => {
    expect(markdown('=begin nested\n=para\n    in quote\n=end nested\n')).toBe('> in quote\n\n')
    expect(markdown('=begin nested :nested(2)\n=para\n    B<text> tail\n=end nested\n')).toBe('> > **text** tail\n\n')
  })

  it('writes the first visible line after an invisible one without its indent', () => {
    expect(markdown('=para\nZ<hidden>\n    B<text> tail\n')).toBe('**text** tail\n\n')
    expect(markdown('=para\nX<|entry>\n    B<text> tail\n')).toBe('**text** tail\n\n')
  })

  it('writes a paragraph after a code block and a sample without its indent', () => {
    expect(markdown('=code code\n=para\n    B<after>\n')).toBe('```\ncode\n```\n**after**\n\n')
    expect(markdown('=input sample\n=para\n    B<after>\n')).toBe('```\nsample\n```\n**after**\n\n')
  })

  it('writes the paragraphs of a cell of merged cells without their indent', () => {
    const doc =
      '=begin table\n=begin row\n=begin cell :colspan(2)\n=para\n    B<first>\n=para\n    I<second>\n=end cell\n=begin cell\n=para\n    B<tail>\n=end cell\n=end row\n=end table\n'
    expect(markdown(doc)).toContain('<td colspan="2">\n\n**first**\n\n*second*\n\n</td>\n<td>\n\n**tail**\n\n</td>')
  })

  it('writes a caption with codes without its indent', () => {
    expect(markdown("=set :caption('    B<Title>')\n=begin table\na | b\n=end table\n")).toBe(
      '**Title**\n\n| a | b |\n| --- | --- |\n\n',
    )
  })

  it('writes the definition after its term with one space', () => {
    expect(markdown('=begin defn\nTERM\n     def text\n=end defn\n')).toBe('**TERM:** def text\n\n\n')
  })
})

describe('what stays as it was', () => {
  it('keeps the indent of a line that continues a paragraph', () => {
    expect(markdown('=para\nfirst\n    B<second> tail\n')).toBe('first\n    **second** tail\n\n')
  })

  it('keeps the paragraphs of an item as they are', () => {
    expect(markdown('=begin item\n=para first\n=para\n    B<second>\n=end item\n')).toBe('- first\n\n  **second**\n\n')
    expect(markdown('=begin item :!checked\n=para\n    B<text> tail\n=end item\n')).toBe('- [ ] **text** tail\n\n')
    expect(markdown('=item parent\n=begin item2\n=para first\n    B<second> tail\n=end item2\n=item next\n')).toContain(
      '  - first\n        **second** tail',
    )
  })

  it('writes an indented paragraph of a cell of a pipe table as before', () => {
    const doc =
      '=begin table\n=begin row\n=begin cell\n=para\n    B<text> tail\n=end cell\n=cell b\n=end row\n=end table\n'
    expect(markdown(doc)).toBe('| **text** tail | b |\n| --- | --- |\n\n')
  })

  it('keeps an indent that is code, spaces kept by S<> and a no-break space', () => {
    expect(markdown('=para\nC<    code> tail\n')).toBe('`    code` tail\n\n')
    expect(markdown('=para\nS<    x> tail\n')).toBe('&nbsp;&nbsp;&nbsp;&nbsp;x tail\n\n')
    expect(markdown('=para\nE<nbsp>x\n')).toBe('\u00a0x\n\n')
  })

  it('keeps the indent of a sample inside a quote', () => {
    expect(markdown('=begin nested\n=input\n    sample\n=end nested\n')).toBe('> ```\n>     sample\n> ```\n\n')
    expect(markdown('=begin nested\n=input\nE<32;32;32;32>sample\n=end nested\n')).toBe(
      '> ```\n>     sample\n> ```\n\n',
    )
  })

  it('keeps the spaces between the parts of a paragraph', () => {
    expect(markdown('=para\nword X<- > next\n')).toBe('word -  next\n\n')
    expect(markdown('=para\nB<a> B<b> c\n')).toBe('**a** **b** c\n\n')
  })

  it('writes a paragraph with a writer given by the caller as before', () => {
    const out: string[] = []
    toMarkdown({ writer: new Writer((str: string) => out.push(str)) }).run(tree('=para\nB<a> b\n'))
    expect(out.join('')).toContain('**a** b')
  })
})
