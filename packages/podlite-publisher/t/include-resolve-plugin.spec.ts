import { getFromTree, getNodeId, getTextContentFromNode, makeAttrs, makeInterator, PodNode } from '@podlite/schema'
import {
  isExistsDocBlocks,
  PluginConfig,
  PodliteWebPlugin,
  PodliteWebPluginContext,
  processFile,
  processPlugin,
  publishRecord,
  runSelector,
} from '../src'
import resolvePlugin from '../src/include-resolve-plugin'

const file1 = `
=for NAME  :id<File1>
No name
=begin data :id<data1>
TEST
=end data

=begin data :id<data2>
{"test" : "one"}
=end data

`
const file2 = `
test

=include doc:File1#data2
`
const tctx = { testing: true }

it('listfiles comp: parse', () => {
  const state = [processFile('src/file1.podlite', file1), processFile('src/file2.podlite', file2)]
  const [block] = runSelector('doc:File1#data1', state)
  expect(block).toBeDefined()
  const [block1] = runSelector('doc:File1', state)
  expect(block1).toBeDefined()

  const resT = getTextContentFromNode(block as PodNode).trim()
  expect(resT).toBe('TEST')
  const config: PluginConfig = {
    plugin: resolvePlugin(),
    includePatterns: '.*',
  }
  const [res, ctx] = processPlugin(config, state, tctx)
  const [content] = getFromTree(res[1].node, 'data').map(n => JSON.parse(getTextContentFromNode(n)))
  expect(content).toMatchInlineSnapshot(`
    Object {
      "test": "one",
    }
  `)
})

const termsFile = `
=begin pod :type('glossary')
=head1 Terms

=begin defn :id<alpha>
First term
=end defn

=begin defn :id<beta>
Second term
=end defn

=para Some prose between defns.

=begin defn :id<gamma>
Third term
=end defn
=end pod
`
const glossaryFile = `
=head1 Index
=include file:src/terms.podlite | defn
`

it('runSelector: file:<path> | defn extracts all defn blocks', () => {
  const state = [processFile('src/terms.podlite', termsFile), processFile('src/glossary.podlite', glossaryFile)]
  const blocks = runSelector('file:src/terms.podlite | defn', state) as PodNode[]
  expect(blocks).toHaveLength(3)
  const ids = blocks.map(b => getNodeId(b, {}))
  expect(ids).toEqual(['alpha', 'beta', 'gamma'])
})

it('runSelector: file:<path> with bare filename still matches suffix', () => {
  const state = [processFile('src/terms.podlite', termsFile)]
  const blocks = runSelector('file:terms.podlite | defn', state) as PodNode[]
  expect(blocks).toHaveLength(3)
})

it('runSelector: unresolved file returns []', () => {
  const state = [processFile('src/terms.podlite', termsFile)]
  const blocks = runSelector('file:nonexistent.podlite | defn', state)
  expect(blocks).toEqual([])
})

it('runSelector: comma-separated block names', () => {
  const state = [processFile('src/terms.podlite', termsFile)]
  const blocks = runSelector('file:src/terms.podlite | defn, para', state) as PodNode[]
  // 3 defn + 1 para (inside =begin pod) = 4
  expect(blocks.length).toBeGreaterThanOrEqual(4)
})

it('include-resolve-plugin: inlines defn blocks from file', () => {
  const state = [processFile('src/terms.podlite', termsFile), processFile('src/glossary.podlite', glossaryFile)]
  const config: PluginConfig = {
    plugin: resolvePlugin(),
    includePatterns: '.*',
  }
  const [res] = processPlugin(config, state, tctx)
  const glossary = res.find(r => r.file === 'src/glossary.podlite')
  const defns = getFromTree(glossary!.node, 'defn')
  expect(defns).toHaveLength(3)
  const ids = defns.map(d => getNodeId(d, {}))
  expect(ids).toEqual(['alpha', 'beta', 'gamma'])
})
