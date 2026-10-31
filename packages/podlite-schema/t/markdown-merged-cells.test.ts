import { podlitePluggable } from '../src/pluggableParser'
import { podlite } from '../../core/src'
import { toMarkdown, toAnyRules } from '../src'

// the parser of this package, without plugins, so a run against its earlier source reads that source
const p = podlitePluggable()
const markdown = (doc: string) => String(p.toMarkdown(p.toAst(p.parse(doc, { podMode: 1 }))))
// the path of the command line: the core with its plugins
const withPlugins = (doc: string) => {
  const core = podlite({ importPlugins: true })
  return String(
    toMarkdown({})
      .use(toAnyRules('toMarkdown', core.getPlugins()))
      .run(core.toAst(core.parse(doc, { podMode: 1 }))),
  )
}

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

const blockIn = (cell: string) =>
  `=begin table\n=begin row\n=cell Header\n=cell Other\n=end row\n=begin row\n=begin cell\n${cell}\n=end cell\n=cell Tail\n=end row\n=end table\n`
const rowTail = '<td>\n\nTail\n\n</td>\n</tr>\n</table>\n\n'

describe('a table without merged cells whose cell holds a block in markdown output', () => {
  it('writes the table as a frame with a code block in its cell', () => {
    expect(markdown(blockIn('=code a | b'))).toContain('<td>\n\n```\na | b\n```\n\n</td>\n' + rowTail)
    expect(markdown(blockIn('=code a \\\\| b'))).toContain('<td>\n\n```\na \\\\| b\n```\n\n</td>\n' + rowTail)
  })

  it('writes the table as a frame for a list, a quote, a heading and two paragraphs', () => {
    expect(markdown(blockIn('=item one\n=item two'))).toContain('<td>\n\n- one\n\n- two\n\n</td>\n' + rowTail)
    expect(markdown(blockIn('=item one'))).toContain('<td>\n\n- one\n\n</td>\n' + rowTail)
    expect(markdown(blockIn('=begin nested\nquoted\n=end nested'))).toContain('<td>\n\n> quoted\n\n</td>')
    expect(markdown(blockIn('=head2 Title'))).toContain('<td>\n\n## Title\n\n</td>')
    expect(markdown(blockIn('one\n\ntwo'))).toContain('<td>\n\none\n\ntwo\n\n</td>')
    expect(markdown(blockIn('=para one\n\n=para two'))).toContain('<td>\n\none\n\ntwo\n\n</td>')
  })

  it('writes the table as a frame for a sample, a block without a rule and a table', () => {
    expect(markdown(blockIn('=input one'))).toContain('<td>\n\n```\none\n```\n\n</td>')
    expect(markdown(blockIn('=begin Unknown\nraw <x>\n=end Unknown'))).toContain('<td>\n\nraw &lt;x>\n\n</td>')
    expect(markdown(blockIn('=begin table\n=begin row\n=cell x\n=end row\n=end table'))).toContain(
      '<td>\n\n| x |\n| --- |\n\n</td>',
    )
  })

  it('finds a block in a late cell of a late row and keeps a late header row', () => {
    const doc =
      '=begin table\n=begin row\n=cell a\n=cell b\n=end row\n=begin row :header\n=cell H1\n=cell H2\n=end row\n=begin row\n=cell c\n=begin cell\n=item x\n=end cell\n=end row\n=end table\n'
    const out = markdown(doc)
    expect(out).toContain('<tr>\n<th>\n\nH1\n\n</th>')
    expect(out).toContain('<td>\n\n- x\n\n</td>')
  })

  it('writes code with a bar without a backslash in a cell of the frame and outside tables', () => {
    const doc = '=begin table\n=begin row\n=begin cell\n=item one\n=end cell\n=cell C<a | b>\n=end row\n=end table\n'
    expect(markdown(doc)).toContain('<td>\n\n`a | b`\n\n</td>')
    expect(markdown('=para C<a | b> and K<c | d>\n')).toBe('`a | b` and `c | d`\n\n')
    expect(markdown('=begin code :allow<B>\nx B<a | b> y\n=end code\n')).toBe('```\nx **a | b** y\n```\n')
  })

  it('writes a bar in code with a backslash only in the row of a pipe table inside the frame', () => {
    const doc =
      "=set :caption('C<x | y>')\n=begin table\n=begin row\n=begin cell\n=begin table\n=begin row\n=cell C<a | b>\n=cell K<c | d>\n=cell T<e | f>\n=cell Tail\n=end row\n=end table\n\nC<g | h>\n=end cell\n=end row\n=end table\n"
    const out = markdown(doc)
    expect(out).toContain('| `a \\| b` | `c \\| d` | `e \\| f` | Tail |')
    expect(out).toContain('`g | h`')
  })
})

describe('a table without merged cells that stays a pipe table', () => {
  it('keeps a cell of a markdown table with HTML inside a line', () => {
    const doc = '=begin markdown\n| A | B |\n| - | - |\n| x | 1. **a**<br>2. b |\n=end markdown\n'
    const out = withPlugins(doc)
    expect(out).toContain('| x | 1. **a**<br>2. b |')
    expect(out).not.toContain('<table>')
  })

  it('keeps cells of one paragraph, text, codes and silent nodes', () => {
    const row = (cell: string) =>
      `=begin table\n=begin row\n=begin cell\n${cell}\n=end cell\n=cell b\n=end row\n=end table\n`
    expect(markdown(row('one'))).toContain('| one | b |')
    expect(markdown(row('=para one'))).toContain('| one | b |')
    expect(markdown(row('B<bold> and C<a | b>'))).toContain('| **bold** and `a \\| b` | b |')
    expect(markdown(row('Z<hidden>'))).toContain('|  | b |')
    expect(markdown('=begin table\n=begin row\n=begin cell\n=end cell\n=cell b\n=end row\n=end table\n')).toContain(
      '|  | b |',
    )
    expect(markdown(row('text N<note>'))).toContain('| text [^1] | b |')
    expect(markdown(row('text\n=comment hidden'))).toContain('| text | b |')
    expect(markdown('=begin table\na  b\nc  d\n=end table\n')).toContain('| a | b |')
  })
})
