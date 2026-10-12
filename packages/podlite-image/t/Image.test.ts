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
    <div class="image_block">
      <img src="test">
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

const renderHtml = (str: string): string => {
  const podlite = podlitePluggable().use({ Image, picture: Image })
  return podlite.toHtml(podlite.toAst(podlite.parse(str))).toString()
}

describe('the html of an image block', () => {
  it('is the same on every run and has no id the author did not write', () => {
    const pod = '=begin pod\n=for picture :caption<One>\nx.png\n=end pod\n'
    const first = renderHtml(pod)
    expect(renderHtml(pod)).toBe(first)
    expect(first).toContain('<div class="image_block"><img src="x.png"/>')
  })

  it('writes an id the author gave in the form a link to it takes', () => {
    const html = renderHtml("=begin pod\n=for picture :id('Fig one')\nx.png\n\nSee L<the figure|#Fig one>.\n=end pod\n")
    expect(html).toContain('<div class="image_block" id="Fig-one">')
    expect(html).toContain('<a href="#Fig-one">the figure</a>')
  })

  it('shapes an id the author gave as a link to it does', () => {
    const html = renderHtml('=begin pod\n=for picture :id<v1.2>\nx.png\n\nSee L<the figure|#v1.2>.\n=end pod\n')
    expect(html).toContain('<div class="image_block" id="v12">')
    expect(html).toContain('<a href="#v12">the figure</a>')
  })
})
