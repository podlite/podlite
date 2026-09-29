import * as fs from 'fs'
import * as path from 'path'
import { build } from 'esbuild'
import { frozenIds, parseAttributes, podlitePluggable } from '@podlite/schema'
import type { RecognitionEvent } from '@podlite/schema'
import { parseMd, PluginRegister as markdown } from '@podlite/markdown'
import { PluginRegister as toc } from '@podlite/toc'
import { podlite, readerFor } from '../src'
import { includePlugins } from '../src/lint/rules/include-resolves'

const text = `=begin pod
=head1 Title

=begin code
B<x>
=end code

=begin markdown
# Inside
=end markdown
=end pod
`
const config = { code: parseAttributes(':allow<B>') }
const same = (a, b) => expect(frozenIds()(a)).toEqual(frozenIds()(b))
// the Markdown reader leaves text as strings; the plugin pass turns them into nodes
const holdsBareText = (node): boolean =>
  Array.isArray(node)
    ? node.some(holdsBareText)
    : typeof node === 'string' || (!!node && typeof node === 'object' && holdsBareText(node.content))

describe('readerFor', () => {
  it('reads a text as the parser and its plugins read it, with the settings given', () => {
    for (const parser of [podlite({ importPlugins: true }), podlite({ importPlugins: false }), podlitePluggable()]) {
      const read = readerFor(parser)
      same(read(text, 'a.podlite'), parser.toAst(parser.parse(text, { podMode: 1 })))
      same(read(text, 'a.podlite', config), parser.toAst(parser.parse(text, { podMode: 1, config }), { config }))
    }
  })

  it('applies the settings: a markup code allowed in code blocks is read', () => {
    const read = readerFor(podlite({ importPlugins: true }))
    expect(JSON.stringify(read(text, 'a.podlite'))).not.toContain('"fcode"')
    expect(JSON.stringify(read(text, 'a.podlite', config))).toContain('"fcode"')
  })

  it('hands the recognition list to the parser', () => {
    const recognition: RecognitionEvent[] = []
    const inTest =
      '=begin test\n=begin fixture\n=head1 A\n=end fixture\n=begin future\nx\n=end future\n=begin assert\nhead1\n=end assert\n=end test\n'
    readerFor(podlite({ importPlugins: true }))(inTest, 'a.podlite', undefined, { recognition })
    expect(recognition.map(e => e.kind)).toEqual(['unknown-directive', 'unknown-directive'])
  })

  it('reads a file the format names md as the Markdown reader does, without the plugins', () => {
    const md = '# Title\n\nText.\n'
    const read = readerFor(podlite({ importPlugins: true }), {
      format: file => (file.endsWith('.md') ? 'md' : 'podlite'),
    })
    const tree = read(md, 'a.md', config)
    same(tree, parseMd(md))
    expect(holdsBareText(tree)).toBe(true)
    same(read(text, 'a.podlite'), readerFor(podlite({ importPlugins: true }))(text, 'a.podlite'))
  })
})

describe('the plugins a check reads an included file with', () => {
  it('are those a query reads with, less the image plugin', () => {
    expect(Object.keys(includePlugins).sort()).toEqual(Object.keys({ ...markdown, ...toc }).sort())
    const query = fs.readFileSync(path.resolve(__dirname, '../src/query.ts'), 'utf-8')
    const raised = Array.from(query.matchAll(/PluginRegister: (\w+) \} = require\('(@podlite\/[a-z-]+)'\)/g)).map(
      m => m[2],
    )
    expect(raised.sort()).toEqual(['@podlite/image', '@podlite/markdown', '@podlite/toc'])
  })
})

describe('what the entries carry', () => {
  const inputs = async (entry: string, platform: 'node' | 'browser') => {
    const result = await build({
      entryPoints: [path.resolve(__dirname, entry)],
      bundle: true,
      platform,
      write: false,
      metafile: true,
      logLevel: 'silent',
    })
    return Object.keys(result.metafile.inputs)
  }

  it('the check entry loads no diagram renderer', async () => {
    const files = await inputs('../src/lint/index.ts', 'node')
    expect(files.filter(f => /podlite-diagrams|podlite-image|mermaid|node_modules\/react\//.test(f))).toEqual([])
  })

  it('the assembly entry loads no Markdown reader', async () => {
    const files = await inputs('../src/assemble/index.ts', 'browser')
    expect(files.filter(f => /podlite-markdown|remark-parse/.test(f))).toEqual([])
  })
})
