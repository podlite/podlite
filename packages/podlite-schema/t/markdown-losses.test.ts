import { podlite } from '../../core/src'
import { toMarkdown, toHtml, toAnyRules } from '../src'

// the path of the command line: the core with its plugins
const core = podlite({ importPlugins: true })
const tree = (doc: string, opt: object) => core.toAst(core.parse(doc, opt))
const markdown = (doc: string, opt: object = { podMode: 1 }, renderMode = 'production') =>
  String(toMarkdown({ renderMode }).use(toAnyRules('toMarkdown', core.getPlugins())).run(tree(doc, opt)))
const html = (doc: string, opt: object = { podMode: 1 }, renderMode = 'production') =>
  String(toHtml({ renderMode }).use(toAnyRules('toHtml', core.getPlugins())).run(tree(doc, opt))).replace(
    / id="[A-Za-z0-9_-]{21}"/g,
    '',
  )
const md = { mode: 'md' }
const titleOf = (text: string) => {
  const found = JSON.stringify(tree(text, md)).match(/"type":"image"[^}]*"title":("(?:[^"\\]|\\.)*")/)
  return found ? JSON.parse(found[1]) : undefined
}

describe('markdown read and written again', () => {
  it('keeps a rule between paragraphs', () => {
    expect(markdown('a\n\n---\n\nb\n', md)).toBe('a\n\n---\nb\n')
    expect(html('a\n\n---\n\nb\n', md)).toBe('<p>a</p><hr><p>b</p>')
  })

  it('keeps a hard line break written either way, and a soft one as it was', () => {
    expect(markdown('a  \nb\n', md)).toBe('a  \nb\n')
    expect(markdown('a\\\nb\n', md)).toBe('a  \nb\n')
    expect(html('a  \nb\n', md)).toBe('<p>a<br>b</p>')
  })

  it('keeps the title of a picture as its hint, in a paragraph, a heading and a cell', () => {
    expect(markdown('Before ![alt](x.png "Tip") after.\n', md)).toBe('Before ![alt](x.png "Tip") after.\n')
    expect(markdown('# H ![alt](x.png "Tip")\n', md)).toBe('# H ![alt](x.png "Tip")\n')
    expect(markdown('| a | b |\n| - | - |\n| ![alt](x.png "Tip") | c |\n', md)).toContain(
      '<td>\n\n![alt](x.png "Tip")\n\n</td>',
    )
    expect(html('![alt](x.png "Tip")\n', md)).toContain('<img src="x.png" alt="alt" title="Tip"/>')
  })

  it('writes a title with quotes, a backslash and character references a reader takes back as it was', () => {
    const source = '![a](x "q \\"r\\" \\\\ &amp;copy; &amp;#65;")\n'
    const written = markdown(source, md)
    expect(written).toBe('![a](x "q \\"r\\" \\\\ &amp;copy; &amp;#65;")\n')
    expect(titleOf(written)).toBe('q "r" \\ &copy; &#65;')
    expect(titleOf(written)).toBe(titleOf(source))
  })

  it('hides the title of a hidden picture and shows it in a draft', () => {
    const doc = '=begin markdown :masked\n![alt](x.png "Secret")\n=end markdown\n'
    expect(markdown(doc)).toBe('![███](x.png "██████")\n\n')
    expect(markdown(doc, { podMode: 1 }, 'draft')).toBe('![alt](x.png "Secret")\n\n')
    expect(html(doc)).toContain('<img src="x.png" alt="███" title="██████"/>')
    expect(html(doc, { podMode: 1 }, 'draft')).toContain('<img src="x.png" alt="alt" title="Secret"/>')
  })

  it('stands a block of HTML between blank lines, adding only what is missing', () => {
    expect(markdown('<br>\n\nAfter\n', md)).toBe('<br>\n\nAfter\n')
    expect(markdown('Before\n\n<br>\n\nAfter\n', md)).toBe('Before\n\n<br>\n\nAfter\n')
    expect(markdown('=para Before\n\n=begin markdown\n<br>\n\nAfter\n=end markdown\n')).toBe(
      'Before\n\n<br>\n\nAfter\n\n',
    )
    expect(markdown('Before\n\n<x-thing>\n\nAfter\n', md)).toBe('Before\n\n<x-thing>\n\nAfter\n')
    expect(markdown('Before\n\n<div>\nx\n</div>\n\nAfter\n', md)).toBe('Before\n\n<div>\nx\n</div>\n\nAfter\n')
  })

  it('keeps a block of HTML inside a quote and an item, and a tight list tight', () => {
    expect(markdown('> Before\n>\n> <div>x</div>\n>\n> After\n', md)).toBe(
      '> Before\n>\n> <div>x</div>\n>\n> After\n\n',
    )
    expect(markdown('- Before\n\n  <div>x</div>\n\n  After\n', md)).toBe('- Before\n\n  <div>x</div>\n\n  After\n')
    expect(markdown('- <div>x</div>\n- y\n', md)).toBe('- <div>x</div>\n- y\n')
    expect(markdown('- <br>\n- y\n', md)).toBe('- <br>\n- y\n')
    expect(markdown('> <div>x</div>\n\nAfter\n', md)).toBe('> <div>x</div>\n\nAfter\n')
  })

  it('owes the blank line after HTML to the content that follows, not to what is written aside', () => {
    expect(markdown('<div>x</div>\n\n`code`\n', md)).toBe('<div>x</div>\n\n`code`\n')
    expect(markdown('<div>x</div>\n\n```\ncode\n```\n', md)).toBe('<div>x</div>\n\n```\ncode\n```\n')
    expect(markdown('<div>x</div>\n\n> After\n', md)).toBe('<div>x</div>\n\n> After\n\n')
    expect(markdown('<div>x</div>\n\n---\n\nAfter\n', md)).toBe('<div>x</div>\n\n---\nAfter\n')
    expect(markdown('<div>x</div>\n\n| a | b |\n| - | - |\n| c | d |\n', md)).toBe(
      '<div>x</div>\n\n| a | b |\n| --- | --- |\n| c | d |\n\n',
    )
    expect(markdown('<div>x</div>\n', md)).toBe('<div>x</div>\n')
  })

  it('writes HTML first in a cell of a frame without a blank line of its own', () => {
    const doc =
      '=begin table\n=begin row\n=begin cell\n=begin markdown\n<br>\n=end markdown\n=end cell\n=end row\n=end table\n'
    expect(markdown(doc)).toContain('<td>\n\n&lt;br>\n\n</td>')
  })

  it('keeps the blocks of a markdown block in a cell apart', () => {
    const doc =
      '=begin table\n=begin row\n=begin cell\n=begin markdown\nBefore\n\n<br>\n\nAfter\n=end markdown\n=end cell\n=end row\n=end table\n'
    expect(markdown(doc)).toContain('<td>\n\nBefore\n\n&lt;br>\n\nAfter\n\n</td>')
  })

  it('keeps a rule and a hard line break inside a quote', () => {
    expect(markdown('> a\n>\n> ---\n>\n> b\n', md)).toBe('> a\n>\n> ---\n> b\n\n')
    expect(markdown('> a  \n> b\n', md)).toBe('> a  \n> b\n\n')
  })
})

describe('what stays as it was', () => {
  it('writes a picture without a title as before, and a title markdown left empty as none', () => {
    expect(markdown('![a](x)\n', md)).toBe('![a](x)\n')
    expect(markdown('![a](x "")\n', md)).toBe('![a](x)\n')
  })

  it('keeps HTML of a line in its line', () => {
    expect(markdown('a<em>b</em>c\n', md)).toBe('a<em>b</em>c\n')
    expect(markdown('a<i\nclass="x">b</i>c\n', md)).toBe('a<i\nclass="x">b</i>c\n')
    expect(markdown('# h <b>x</b>\n\n**s <b>x</b>** *e <i>y</i>* ~~d <s>z</s>~~ [l <b>k</b>](u)\n', md)).toBe(
      '# h <b>x</b>\n**s <b>x</b>** *e <i>y</i>* ~~d <s>z</s>~~ [l <b>k</b>](u)\n',
    )
    expect(markdown('[a<br>b][r]\n\n[r]: x\n', md)).toBe('[a<br>b](x)\n')
  })

  it('writes HTML of a tree without the new field, and of its copy, as it did', () => {
    const read = tree('Before\n\n<br>\n\nAfter\n', md)
    const run = (ast: object) =>
      String(
        toMarkdown({})
          .use(toAnyRules('toMarkdown', core.getPlugins()))
          .run(ast as any),
      )
    expect(run(JSON.parse(JSON.stringify(read)))).toBe('Before\n\n<br>\n\nAfter\n')
    const old = JSON.parse(JSON.stringify(read), (key, value) => (key === 'markdownHtml' ? undefined : value))
    expect(run(old)).toBe('Before\n<br>After\n')
  })

  it('keeps a picture, an =Html block and a boundary of the author', () => {
    expect(markdown('=begin picture :caption<Cap>\nx.png\n=end picture\n\n=para After\n')).toBe(
      '![](x.png)\n\nCap\n\nAfter\n\n',
    )
    expect(markdown('=Html <br>\n\n=para After\n')).toBe('```\n<br>\n```\n\nAfter\n\n')
    expect(markdown('=para a\n\n=boundary\n\n=para b\n')).toBe('a\n\n\n---\nb\n\n')
  })
})

describe('a picture of the tree given by a program', () => {
  const doc = (image: object) => ({
    type: 'block',
    name: 'root',
    margin: '',
    content: [{ type: 'para', margin: '', text: '', content: [{ type: 'image', src: 'x', alt: 'a', ...image }] }],
  })
  const run = (writer: any, ast: object, renderMode = 'production') =>
    String(
      writer({ renderMode })
        .use(toAnyRules(writer === toHtml ? 'toHtml' : 'toMarkdown', core.getPlugins()))
        .run(ast),
    )

  it('writes an empty title as written', () => {
    expect(run(toMarkdown, doc({ title: '' }))).toBe('![a](x "")\n')
    expect(run(toHtml, doc({ title: '' }))).toContain('<img src="x" alt="a" title=""/>')
    expect(String(core.toHtml(doc({ title: '' }) as any))).toContain('title=""')
  })

  it('hides the title of a hidden picture on every path and shows it in a draft', () => {
    const hidden = doc({ title: 'Secret', guarded: true })
    expect(run(toMarkdown, hidden)).toBe('![█](x "██████")\n')
    expect(run(toHtml, hidden)).toContain('title="██████"')
    expect(run(toHtml, hidden, 'draft')).toContain('title="Secret"')
    expect(String(core.toHtml(hidden as any))).toContain('title="██████"')
  })
})

describe('the new fields in the schema of the tree', () => {
  const { definitions } = require('../schema/AstTree.json')
  const Ajv = require('ajv')
  const ajv = new Ajv({ strict: false, allowUnionTypes: true, strictTuples: false })
  const check = (name: string, node: object) => ajv.validate({ $ref: `#/definitions/${name}`, definitions }, node)

  it('lets a picture go with a title or without one, and refuses another type', () => {
    const image = { type: 'image', src: 'x' }
    expect(definitions.Image.properties.title).toEqual({ type: 'string' })
    expect(check('Image', image)).toBe(true)
    expect(check('Image', { ...image, title: '' })).toBe(true)
    expect(check('Image', { ...image, title: 7 })).toBe(false)
  })

  it('lets a block go with HTML of a block or a line, and refuses another value', () => {
    const block = {
      type: 'block',
      name: 'Html',
      location: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 4, line: 1, column: 5 } },
      content: [],
      margin: '',
    }
    expect(definitions.BlockNamed.properties.markdownHtml).toEqual({ enum: ['block', 'inline'], type: 'string' })
    expect(check('BlockNamed', block)).toBe(true)
    expect(check('BlockNamed', { ...block, markdownHtml: 'block' })).toBe(true)
    expect(check('BlockNamed', { ...block, markdownHtml: 'inline' })).toBe(true)
    expect(check('BlockNamed', { ...block, markdownHtml: 'both' })).toBe(false)
  })
})
