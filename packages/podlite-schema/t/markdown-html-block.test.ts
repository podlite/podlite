import { podlite } from '../../core/src'
import { toMarkdown, toAnyRules } from '../src'

// the path of the command line: the core with its plugins
const core = podlite({ importPlugins: true })
const markdown = (doc: string, opt: object = { podMode: 1 }, renderMode = 'production') =>
  String(
    toMarkdown({ renderMode })
      .use(toAnyRules('toMarkdown', core.getPlugins()))
      .run(core.toAst(core.parse(doc, opt))),
  )

describe('an =Html block of the author in markdown output', () => {
  it('writes the body in a fence and the next paragraph on its own', () => {
    expect(markdown('=begin Html\n<style>p { display: none }</style>\n=end Html\n\n=para After\n')).toBe(
      '```\n<style>p { display: none }</style>\n```\n\nAfter\n\n',
    )
    expect(markdown('=begin Html\n<!-- open\n=end Html\n\n=para After\n')).toBe('```\n<!-- open\n```\n\nAfter\n\n')
  })

  it('hides the body of a masked block and shows it in a draft', () => {
    expect(markdown('=for Html :masked\nsecret\n\n=para After\n')).toBe('```\n██████\n```\n\nAfter\n\n')
    expect(markdown('=for Html :masked\nsecret\n', { podMode: 1 }, 'draft')).toBe('```\nsecret\n```\n\n')
  })

  it('writes the body as text inside a quote', () => {
    expect(markdown('=begin nested\n=begin Html\n<style>x</style>\n=end Html\n=end nested\n')).toBe(
      '> \\<style>x\\</style>\n\n',
    )
  })

  it('makes the fence longer than a run of backticks in the body', () => {
    expect(markdown('=begin Html\n```\nx\n=end Html\n')).toBe('````\n```\nx\n````\n\n')
  })

  it('writes the body as written inside a frame of a table', () => {
    const doc =
      '=begin table\n=begin row\n=begin cell :colspan(2)\n=begin Html\n</table>&amp;\nsecond\n=end Html\n=end cell\n=end row\n=end table\n'
    expect(markdown(doc)).toContain('<td colspan="2">\n\n```\n</table>&amp;\nsecond\n```\n\n</td>')
  })

  it('keeps raw HTML of markdown and fences the =Html of the author in one document', () => {
    expect(markdown('=begin markdown\nText <br> more\n=end markdown\n\n=begin Html\n<b>x</b>\n=end Html\n')).toBe(
      'Text <br> more\n```\n<b>x</b>\n```\n\n',
    )
  })

  it('writes nothing for an empty =Html, also for a body of one empty line', () => {
    expect(markdown('=begin Html\n=end Html\n\n=para A\n')).toBe('A\n\n')
    expect(markdown('=begin Html\n\n=end Html\n=para A\n')).toBe('A\n\n')
  })

  it('writes a table whose cell holds an =Html of the author as a frame with the body in a fence', () => {
    const doc = '=begin table\n=begin row\n=begin cell\n=Html <b>x</b>\n=end cell\n=cell Tail\n=end row\n=end table\n'
    expect(markdown(doc)).toBe(
      '<table>\n<tr>\n<td>\n\n```\n<b>x</b>\n```\n\n</td>\n<td>\n\nTail\n\n</td>\n</tr>\n</table>\n\n',
    )
  })

  it('writes nothing for a body of spaces only', () => {
    expect(markdown('=begin Html\n   \n=end Html\n=para A\n')).toBe('A\n\n')
  })

  it('keeps raw a copy of a block that carries the mark of markdown', () => {
    const tree = core.toAst(core.parse('Text <br> more\n', { mode: 'md' }))
    const para = tree.content[0] as { content: object[] }
    para.content = para.content.map(part => (typeof part === 'object' ? { ...part } : part))
    expect(String(toMarkdown({}).use(toAnyRules('toMarkdown', core.getPlugins())).run(tree))).toBe('Text <br> more\n')
  })

  it('fences an Html block a plugin put in later without the mark of markdown', () => {
    const tree = core.toAst(core.parse('=para Before\n', { podMode: 1 }))
    const html = { type: 'block', name: 'Html', margin: '', content: [{ type: 'verbatim', value: '<i>x</i>' }] }
    tree.content.push(html as never)
    const out = String(toMarkdown({}).use(toAnyRules('toMarkdown', core.getPlugins())).run(tree))
    expect(out).toContain('```\n<i>x</i>\n```')
  })
})

describe('what stays as it was', () => {
  it('keeps HTML of markdown raw, in the =markdown block and in a document read as markdown', () => {
    expect(markdown('=begin markdown\nText <br> more\n\n<div>\nx\n</div>\n=end markdown\n')).toBe(
      'Text <br> more\n<div>\nx\n</div>',
    )
    expect(markdown('Text <br> more\n\n<div>\nx\n</div>\n', { mode: 'md' })).toBe('Text <br> more\n<div>\nx\n</div>')
  })

  it('keeps HTML of markdown raw in a list, an emphasis, a link, a heading and a quote', () => {
    expect(markdown('- a <b>x</b>\n', { mode: 'md' })).toBe('- a <b>x</b>\n')
    expect(markdown('*a <b>x</b>*\n', { mode: 'md' })).toBe('*a <b>x</b>*\n')
    expect(markdown('[<img src="b.svg">](https://example.org/)\n', { mode: 'md' })).toBe(
      '[<img src="b.svg">](https://example.org/)\n',
    )
    expect(markdown('# h <b>x</b>\n', { mode: 'md' })).toBe('# h <b>x</b>\n')
    expect(markdown('> <div>q</div>\n', { mode: 'md' })).toBe('> <div>q</div>')
  })

  it('keeps a markdown table with HTML in a cell a pipe table', () => {
    expect(markdown('| a | b |\n| - | - |\n| x<br>y | c |\n', { mode: 'md' })).toContain('| x<br>y | c |')
  })

  it('writes HTML of markdown with a closing table tag inside a frame as text', () => {
    const doc =
      '=begin table\n=begin row\n=begin cell :colspan(2)\n=begin markdown\nA </table>&amp;\n=end markdown\n=end cell\n=end row\n=end table\n'
    expect(markdown(doc)).toBe('<table>\n<tr>\n<td colspan="2">\n\nA &lt;/table>\\&\n\n</td>\n</tr>\n</table>\n\n')
  })

  it('writes HTML of markdown inside a frame with the sign of a tag escaped', () => {
    const doc =
      '=begin table\n=begin row\n=begin cell :colspan(2)\n=begin markdown\nA <b>x</b>\n=end markdown\n=end cell\n=end row\n=end table\n'
    expect(markdown(doc)).toContain('A &lt;b>x&lt;/b>')
  })
})
