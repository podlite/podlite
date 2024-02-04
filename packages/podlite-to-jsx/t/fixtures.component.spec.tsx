import Podlite from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const fs = require('fs')
const path = require('path')
const glob = require('glob')

// load examples from fixtures src
/**
 * 
 * @returns 
 * { file: '/Users/zag/Dropbox/Work/proj/podlite/packages/podlite-to-jsx/t/fixtures-src/00-maintests.t', 
    id: 5, 
    text: '=config table :k1<very long string, comma> :k2<2 23  23 > :k3<\'23\', 23233, 333>\n', 
    testFile: 't/fixtures/00-maintests_5.txt' }, 
 */
const allSrcFixtures = () => {
  const pathToTests = path.resolve(__dirname, './fixtures-src')
  const files = glob.sync(`${pathToTests}/*.t`)
  const loaded = files
    .map(file => {
      const d = fs.readFileSync(file)
      const s = `${d}`
        .split(/#---+\n/)
        .filter(t => t.match(/^\s*=/))
        .map((text, i) => {
          const { dir, name } = path.parse(file)
          const testFile = `t/fixtures/${name}_${i}.txt`
          return { file, id: i, text, testFile }
        })
      return s
    })
    .flat()
  return loaded
}
const t = allSrcFixtures()
t

describe('run parser tests', () => {
  allSrcFixtures().map(i =>
    test(i.file, () => {
      const result = renderToStaticMarkup(<Podlite>{i.text}</Podlite>)
      expect(result).not.toBeNull()
    }),
  )
})
