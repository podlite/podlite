import { execFileSync } from 'child_process'
import * as path from 'path'
import { podlite } from '../../core/src'
import { toMarkdown, toAnyRules } from '../src'

// the path of the command line: the core with its plugins
const core = podlite({ importPlugins: true })
const markdown = (doc: string) =>
  String(
    toMarkdown({})
      .use(toAnyRules('toMarkdown', core.getPlugins()))
      .run(core.toAst(core.parse(doc, { podMode: 1 }))),
  )
// the readers are modules of their own, so they are run in a process of their own
const readBoth = (texts: string[]) =>
  JSON.parse(
    execFileSync('node', [path.join(__dirname, 'reference-readers.mjs')], {
      input: JSON.stringify(texts),
      cwd: path.join(__dirname, '../../..'),
      encoding: 'utf8',
    }),
  )

const references = '&copy; &#65; &#x41; &amp;copy;'
const address = 'https://example.org/?a=&copy;&b=&#65;&c=&#x41;&d=&amp;copy;'

describe('a character reference in markdown output, read by two readers', () => {
  it('reads the address and the title of a link back as written', () => {
    const doc = `=para L<ok|${address} :title('${references}')>\n`
    const [read] = readBoth([markdown(doc)])
    for (const reader of [read.marked, read.remark])
      expect(reader).toEqual([{ url: address, title: references, alt: null }])
  })

  it('reads the address, the title and the alternative text of a picture back as written', () => {
    const escaped = (text: string) => text.replace(/&/g, '&amp;')
    const doc = `=begin markdown\n![${escaped(references)}](${escaped(address)} "${escaped(
      references,
    )}")\n=end markdown\n`
    const [read] = readBoth([markdown(doc)])
    for (const reader of [read.marked, read.remark])
      expect(reader).toEqual([{ url: address, title: references, alt: references }])
  })
})
