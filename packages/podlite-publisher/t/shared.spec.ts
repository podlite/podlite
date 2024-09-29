import { isExistsDocBlocks, processFile } from '../src'

const file1 = `
  import { getFromTree, makeAttrs } from '@podlite/schema'
`
const file2 = `
test
`

const tctx = { testing: true }
it('listfiles comp: parse', () => {
  const state = [processFile('src/file2.js', file1), processFile('src/file2.podlite', file2)]

  const docs = state.map(item => isExistsDocBlocks(item.node))
  expect(docs).toMatchInlineSnapshot(`
Array [
  false,
  true,
]
`)
})
