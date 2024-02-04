import * as path from 'path'
import * as fs from 'fs'
const glob = require('glob')
import { parse } from 'pod6'
import makeAttrs from 'pod6/built/helpers/config'
import toAny from 'pod6/built/exportAny'

export const loadFixture = (filename = 't/fixtures/01-delimited_3.txt', testPath: string) => {
  const content = fs.readFileSync(filename)
  const tree = parse(content.toString())
  let codeBlocks = []
  let id = 0
  const rules = {
    code: () => (node, ctx) => {
      const { dir, name } = path.parse(filename)
      const attr = makeAttrs(node, ctx)
      // overwrite id from block attributes
      const fid = attr.exists('id') ? attr.getFirstValue('id') : ++id
      if (node.content[0].value)
        codeBlocks.push({
          filename,
          id: fid,
          testFile: `${testPath}/${name}_${fid}.txt`,
          text: node.content[0].value,
        })
    },
  }
  const toF = toAny({ processor: 1 }).use(rules).run(tree)
  return codeBlocks
}

export const loadSrcFixtures = (path: string, testPath: string) => {
  const rawSrcFixtures = glob.sync(path)
  return rawSrcFixtures.map(filename => loadFixture(filename, testPath)).flat()
}
