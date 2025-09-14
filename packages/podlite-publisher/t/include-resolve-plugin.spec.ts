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
