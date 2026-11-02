import { podlitePluggable } from '../src/pluggableParser'

// the parser of this package
const p = podlitePluggable()
const markdown = (doc: string) => String(p.toMarkdown(p.toAst(p.parse(doc, { podMode: 1 }))))

describe('code in markdown output', () => {
  it('writes the signs inside code as they stand', () => {
    expect(markdown('=para C<a*b|c>\n')).toBe('`a*b|c`\n\n')
    expect(markdown('=para C<\\ * _ [ ] # |> K<x_y> T<a*b>\n')).toBe('`\\ * _ [ ] # |` `x_y` `a*b`\n\n')
    expect(markdown('=para C<`q`>\n')).toBe('`` `q` ``\n\n')
  })

  it('writes code as it stands in a heading, an item, a quote and a frame of a table', () => {
    expect(markdown('=head1 C<a_b>\n')).toBe('# `a_b`\n\n')
    expect(markdown('=item C<a_b *c*>\n')).toBe('- `a_b *c*`\n\n')
    expect(markdown('=nested C<a_b>\n')).toBe('> `a_b`\n\n')
    const frame =
      '=begin table\n=begin row\n=begin cell :colspan(2)\nC<a_b|c>\n=end cell\n=end row\n=begin row\n=cell l\n=cell r\n=end row\n=end table\n'
    expect(markdown(frame)).toContain('<td colspan="2">\n\n`a_b|c`\n\n</td>')
  })

  it('writes the text of a markup code inside the fence of a sample as it stands', () => {
    expect(markdown('=input B<a_b> and *c*\n')).toBe('```\n**a_b** and *c*\n```\n')
    expect(markdown('=input K<a_b>\n')).toBe('```\n`a_b`\n```\n')
  })

  it('escapes only the bars of code in a cell of a pipe table', () => {
    expect(markdown('=begin table\n=begin row\n=cell C<a*b|c>\n=cell x\n=end row\n=end table\n')).toBe(
      '| `a*b\\|c` | x |\n| --- | --- |\n\n',
    )
    expect(markdown('=begin table\n=begin row\n=cell C<a|b|c>\n=cell x\n=end row\n=end table\n')).toContain(
      '| `a\\|b\\|c` |',
    )
    // a backslash of the code right before a bar is doubled, so the bar stays escaped
    expect(markdown('=begin table\n=begin row\n=cell C<a\\|b> and C<c\\d>\n=cell x\n=end row\n=end table\n')).toContain(
      '| `a\\\\\\|b` and `c\\d` | x |',
    )
  })

  it('keeps the spaces at both ends of code a reader would take off', () => {
    expect(markdown('=para C< a_b >\n')).toBe('`  a_b  `\n\n')
    expect(markdown('=para C< a>\n')).toBe('` a`\n\n')
    expect(markdown('=para C< \n >\n')).toBe('` \n `\n\n')
    expect(markdown('=para C<\na_b >\n')).toBe('` \na_b  `\n\n')
  })
})

describe('what stays as it was', () => {
  it('keeps the backslash before a bar in code in a cell of a pipe table', () => {
    expect(markdown('=begin table\n=begin row\n=cell C<a|b>\n=cell x\n=end row\n=end table\n')).toContain('| `a\\|b` |')
  })

  it('escapes the signs of text outside code', () => {
    expect(markdown('=para a_b *c* [d]\n')).toBe('a\\_b \\*c\\* \\[d\\]\n\n')
  })
})
