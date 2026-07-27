// import  * as Image  from '../src';
import {
  frozenIds,
  getFromTree,
  mkBlock,
  mkImage,
  mkRootBlock,
  PodliteDocument,
  podlitePluggable,
  validateAstTree,
} from '@podlite/schema'
import Image from '../src/index'

const parse = (str: string): PodliteDocument => {
  let podlite = podlitePluggable().use({ Image, picture: Image })
  let tree = podlite.parse(str)
  const asAst = podlite.toAst(tree)
  return asAst
}

const parseToHtml = (str: string): string => {
  let podlite = podlitePluggable().use({ Image, picture: Image })
  let tree = podlite.parse(str)
  const asAst = podlite.toAst(tree)
  return podlite.toHtml(frozenIds()(asAst)).toString()
}

const cleanHTML = (html: string) => {
  return html.replace(/\n+/g, '')
}

it('AST validate', () => {
  const p = parse(`=picture test.png
    short caption`)
  const Image = getFromTree(p, 'picture')[0]
  const r = validateAstTree([Image])
  expect(r).toEqual([])
})
it('=picture minimal', () => {
  const pod = `=for picture 
test`
  const html = parseToHtml(pod)
  expect(html).toMatchInlineSnapshot(`
    <div class="image_block"
         id="id"
    >
      <img src="test"
           alt="undefined"
      >
    </div>
  `)
})

it('Picture', () => {
  const pod = `=for picture :id<111> :alt('testAlt') :caption('testCaption') :link('testLink')
test.png
`
  const html = parseToHtml(pod)
  expect(html).toMatchInlineSnapshot(`
    <div class="image_block"
         id="111"
    >
      <a href="testLink">
        <img src="test.png"
             alt="testAlt"
        >
      </a>
      <div class="caption">
        testCaption
      </div>
    </div>
  `)
})

it('Image block wrapping an inline image node keeps the src', () => {
  let podlite = podlitePluggable().use({ Image, picture: Image })
  const tree = mkRootBlock({}, [
    mkBlock(
      { type: 'block', name: 'Image', location: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } } },
      [mkImage('https://example.org/badge.svg', 'build')],
    ),
  ])
  const html = podlite.toHtml(frozenIds()(podlite.toAst(tree))).toString()
  expect(html).toContain('src="https://example.org/badge.svg"')
})
