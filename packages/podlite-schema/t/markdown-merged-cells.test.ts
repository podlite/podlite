import { podlitePluggable } from '../src/pluggableParser'

// the parser of this package, without plugins, so a run against its earlier source reads that source
const p = podlitePluggable()
const markdown = (doc: string) => String(p.toMarkdown(p.toAst(p.parse(doc, { podMode: 1 }))))

const merged = (cell: string) =>
  `=begin table\n=begin row\n=begin cell :colspan(2)\n${cell}\n=end cell\n=end row\n=begin row\n=cell Left\n=cell Right\n=end row\n=end table\n`

const tail = '<tr>\n<td>\n\nLeft\n\n</td>\n<td>\n\nRight\n\n</td>\n</tr>\n</table>\n\n'

describe('a cell of a table with merged cells in markdown output', () => {
  it('writes the cell as markdown between blank lines', () => {
    expect(markdown(merged('L<ok|https://example.org/> B<bold> and I<it>'))).toBe(
      '<table>\n<tr>\n<td colspan="2">\n\n[ok](https://example.org/) **bold** and *it*\n\n</td>\n</tr>\n' + tail,
    )
  })

  it('escapes text as markdown text', () => {
    expect(markdown(merged('a*b _c_ [d]'))).toContain('<td colspan="2">\n\na\\*b \\_c\\_ \\[d\\]\n\n</td>')
    expect(markdown(merged('plain <Audit> & text'))).toContain('<td colspan="2">\n\nplain \\<Audit> & text\n\n</td>')
  })

  it('ends the cell with one blank line before the closing tag', () => {
    expect(markdown(merged('=para Para one\n\n=para Para two'))).toContain(
      '<td colspan="2">\n\nPara one\n\nPara two\n\n</td>\n',
    )
  })

  it('keeps the items of a list in one cell', () => {
    expect(markdown(merged('=item one\n=item two'))).toContain('<td colspan="2">\n\n- one\n\n- two\n\n</td>')
  })

  it('writes a picture of the cell as outside a table', () => {
    const picture = '=config P<> :allow<E>\n\n' + merged('P<E<lt>Audit TitleE<gt>|x.png>')
    const outside = markdown('=config P<> :allow<E>\n\n=para P<E<lt>Audit TitleE<gt>|x.png>\n').trim()
    expect(markdown(picture)).toContain(`<td colspan="2">\n\n${outside}\n\n</td>`)
  })

  it('keeps the body of a code block as written', () => {
    expect(markdown(merged('=begin code :lang<sh>\na\n\n    <Audit Title>\n   \n=end code'))).toContain(
      '<td colspan="2">\n\n```sh\na\n\n    <Audit Title>\n   \n```\n\n</td>',
    )
    expect(markdown(merged('=input one'))).toContain('<td colspan="2">\n\n```\none\n```\n\n</td>')
  })

  it('numbers notes in a cell and after the table in one run', () => {
    const out = markdown(merged('First N<First note>') + '\n=para After N<Second note>\n')
    expect(out).toContain('<td colspan="2">\n\nFirst [^1]\n\n</td>')
    expect(out).toContain('After [^2]')
    expect(out).toContain('[^1]: First note\n[^2]: Second note\n')
  })

  it('writes a table inside a cell with its own cells, and the text after it in the same cell', () => {
    const inner =
      '=begin table\n=begin row\n=begin cell :colspan(2)\nInner\n=end cell\n=end row\n=begin row\n=cell x\n=cell y\n=end row\n=end table\n\n=para Outer'
    expect(markdown(merged(inner))).toBe(
      '<table>\n<tr>\n<td colspan="2">\n\n<table>\n<tr>\n<td colspan="2">\n\nInner\n\n</td>\n</tr>\n<tr>\n<td>\n\nx\n\n</td>\n<td>\n\ny\n\n</td>\n</tr>\n</table>\n\nOuter\n\n</td>\n</tr>\n' +
        tail,
    )
  })

  it('writes the table of the specification with headers and spans', () => {
    const doc =
      '=begin table\n\n=begin row :header\n  =for cell :colspan(2)\n  Item and Quantity \n  =cell Description\n=end row\n\n=begin row\n  =cell Apples\n  =cell 5\n  =for cell :rowspan(2)\n  Fruit for snacking\n=end row\n\n=begin row\n  =cell Bananas\n  =cell 3\n=end row\n\n=end table\n'
    expect(markdown(doc)).toBe(
      '<table>\n<tr>\n<th colspan="2">\n\nItem and Quantity \n\n</th>\n<th>\n\nDescription\n\n</th>\n</tr>\n' +
        '<tr>\n<td>\n\nApples\n\n</td>\n<td>\n\n5\n\n</td>\n<td rowspan="2">\n\nFruit for snacking\n\n</td>\n</tr>\n' +
        '<tr>\n<td>\n\nBananas\n\n</td>\n<td>\n\n3\n\n</td>\n</tr>\n</table>\n\n',
    )
  })

  it('closes a cell with nothing to show on its own line', () => {
    expect(markdown(merged(''))).toContain('<td colspan="2"></td>\n')
    expect(markdown(merged('   Z<hidden>   '))).toContain('<td colspan="2"></td>\n')
  })
})

describe('what stays as it was', () => {
  it('writes raw text of a block without a rule as HTML text inside the frame', () => {
    expect(markdown(merged('=begin Unknown\nAudit </table> End\n=end Unknown'))).toContain('Audit &lt;/table> End')
  })

  it('writes a table without merged cells as a pipe table', () => {
    expect(markdown('=begin table\n=begin row\n=cell C<a | b>\n=cell c\n=end row\n=end table\n')).toContain(
      '| `a \\| b` | c |',
    )
  })

  it('ends the table with a blank line before the next paragraph', () => {
    expect(markdown(merged('x') + '\n=para After\n')).toContain('</table>\n\nAfter\n')
  })
})
