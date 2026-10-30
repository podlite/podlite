import { podlitePluggable } from '../src/pluggableParser'

// the parser of this package, so a run against its earlier source reads that source
const p = podlitePluggable()
const markdown = (doc: string) => String(p.toMarkdown(p.toAst(p.parse(doc, { podMode: 1 }))))
const para = (...lines: string[]) => `=begin para\n${lines.join('\n')}\n=end para\n\n=para After\n`

describe('a sign a reader takes for a block at the start of a line in markdown output', () => {
  it('escapes a line of tildes and every tilde of the text', () => {
    expect(markdown(para('first', '~~~', 'hello'))).toBe('first\n\\~\\~\\~\nhello\n\nAfter\n\n')
    expect(markdown(para('~~~ start', 'more'))).toBe('\\~\\~\\~ start\nmore\n\nAfter\n\n')
    expect(markdown(para('a ~~word~~ b'))).toBe('a \\~\\~word\\~\\~ b\n\nAfter\n\n')
  })

  it('escapes tildes that come in several pieces', () => {
    expect(markdown(para('~Z<x>~~'))).toBe('\\~\\~\\~\n\nAfter\n\n')
    expect(markdown(para('E<126>~~'))).toBe('\\~\\~\\~\n\nAfter\n\n')
    expect(markdown(para('~~Z<x>~word~~'))).toBe('\\~\\~\\~word\\~\\~\n\nAfter\n\n')
  })

  it('escapes the line under a heading and a rule', () => {
    expect(markdown(para('first', '---'))).toBe('first\n\\---\n\nAfter\n\n')
    expect(markdown(para('first', '==='))).toBe('first\n\\===\n\nAfter\n\n')
    expect(markdown(para('---'))).toBe('\\---\n\nAfter\n\n')
    expect(markdown(para('first', '-'))).toBe('first\n\\-\n\nAfter\n\n')
  })

  it('escapes the line that aligns a table of one column', () => {
    expect(markdown(para('Title', ':---'))).toBe('Title\n\\:---\n\nAfter\n\n')
    expect(markdown(para('Title', '---:'))).toBe('Title\n\\---:\n\nAfter\n\n')
    expect(markdown(para('Title', ':---:'))).toBe('Title\n\\:---:\n\nAfter\n\n')
  })

  it('escapes an item and a quote', () => {
    expect(markdown(para('- one', '- two'))).toBe('\\- one\n\\- two\n\nAfter\n\n')
    expect(markdown(para('text', '- one'))).toBe('text\n\\- one\n\nAfter\n\n')
    expect(markdown(para('+ one'))).toBe('\\+ one\n\nAfter\n\n')
    expect(markdown(para('> quoted'))).toBe('\\> quoted\n\nAfter\n\n')
    expect(markdown(para('>x'))).toBe('\\>x\n\nAfter\n\n')
  })

  it('escapes a number that starts a list, also one written in pieces', () => {
    expect(markdown(para('1. one', '2. two'))).toBe('1\\. one\n2\\. two\n\nAfter\n\n')
    expect(markdown(para('1) one'))).toBe('1\\) one\n\nAfter\n\n')
    expect(markdown(para('2026. A year'))).toBe('2026\\. A year\n\nAfter\n\n')
    expect(markdown(para('1Z<x>. one'))).toBe('1\\. one\n\nAfter\n\n')
    expect(markdown(para('E<49>. one'))).toBe('1\\. one\n\nAfter\n\n')
  })

  it('escapes the start of the content after the prefix of an item or a quote', () => {
    expect(markdown('=item ~~~ in item\n')).toBe('- \\~\\~\\~ in item\n\n')
    expect(markdown('=item - x\n')).toBe('- \\- x\n\n')
    expect(markdown('=config item :numbered\n\n=item ~~~\n')).toContain('1. \\~\\~\\~')
    expect(markdown('=begin nested\n=begin nested\n=para - x\n=end nested\n=end nested\n')).toBe('> > \\- x\n\n')
  })

  it('escapes the start of a line after a hard break and inside bold', () => {
    expect(markdown('=para S<first\n>1. x\n')).toContain('first  \n1\\. x')
    expect(markdown('=para B<first\n~~~>\n')).toContain('**first\n\\~\\~\\~**')
  })

  it('escapes a number in a caption written with codes and in a cell of merged cells', () => {
    expect(markdown('=set :caption 1. B<Caption>\n=begin table\na | b\n=end table\n')).toContain('1\\. **Caption**')
    const merged = '=begin table\n=begin row\n=for cell :colspan(2)\n1. Hazard\n=cell Next\n=end row\n=end table\n'
    expect(markdown(merged)).toContain('<td colspan="2">\n\n1\\. Hazard\n\n</td>')
  })
})

describe('what stays as it was', () => {
  it('leaves signs in the middle of a line', () => {
    expect(markdown(para('a - b and 1.5 kg'))).toBe('a - b and 1.5 kg\n\nAfter\n\n')
    expect(markdown(para('-dash word'))).toBe('-dash word\n\nAfter\n\n')
  })

  it('leaves a heading, a cell of a pipe table, code and bold', () => {
    expect(markdown('=head1 1. Intro\n')).toBe('# 1. Intro\n\n')
    expect(markdown('=begin table\n=begin row\n=cell - one\n=cell 1. two\n=end row\n=end table\n')).toContain(
      '| - one | 1. two |',
    )
    expect(markdown('=para C<- x> and C<~~~>\n')).toBe('`- x` and `~~~`\n\n')
    expect(markdown('=para B<- x>\n')).toBe('**- x**\n\n')
    expect(markdown('=begin code\n- x\n~~~\n=end code\n')).toBe('```\n- x\n~~~\n```\n')
  })

  it('leaves a caption written as a string', () => {
    expect(markdown("=begin table :caption('1. Caption')\na | b\n=end table\n")).toContain('**1. Caption**')
  })

  it('leaves a tilde inside an address in the text', () => {
    expect(markdown('=para https://example.org/~user and www.example.org/~a\n')).toBe(
      'https://example.org/~user and www.example.org/~a\n\n',
    )
    expect(markdown('=para HTTP://example.org/~u and Https://example.org/~v\n')).toBe(
      'HTTP://example.org/~u and Https://example.org/~v\n\n',
    )
    expect(markdown('=para WWW.example.org/~~a~~\n')).toBe('WWW.example.org/\\~\\~a\\~\\~\n\n')
  })
})
