import { toMarkdown } from '@podlite/schema'
import { md2ast } from '../src/tools'

// what a reader of CommonMark keeps: the kinds of blocks and codes, with their text
const shape = (node: any): any => {
  if (Array.isArray(node)) return node.map(shape).filter(item => item !== undefined)
  if (typeof node === 'string') return node
  if (!node || typeof node !== 'object') return undefined
  if (node.type === 'blankline') return undefined
  if (node.type === 'image') return { image: node.src, alt: node.alt, title: node.title }
  if (node.type === 'text') return node.value
  const kind = node.type === 'block' ? node.name : node.type === 'fcode' ? node.name : node.type
  return { [kind]: shape(node.content ?? []) }
}
const roundTrip = (src: string) => md2ast(String(toMarkdown({}).run(md2ast(src) as any)))

describe('markdown read, written and read again by a reader of CommonMark', () => {
  it('keeps a rule, a hard line break and the title of a picture', () => {
    for (const src of [
      'a\n\n---\n\nb\n',
      'a  \nb\n',
      'a\\\nb\n',
      'Before ![alt](x.png "Tip") after.\n',
      '![a](x "q \\"r\\" \\\\ &amp;copy;")\n',
      '> a\n>\n> ---\n>\n> b\n',
      '- a  \n  b\n- c\n',
    ]) {
      expect(JSON.stringify(shape(md2ast(src)))).toMatch(/"boundary"|"S"|"title":"/)
      expect(shape(roundTrip(src))).toEqual(shape(md2ast(src)))
    }
  })

  it('keeps a block of HTML apart from the paragraphs around it, and a tight list tight', () => {
    for (const src of [
      'Before\n\n<br>\n\nAfter\n',
      'Before\n\n<div>\nx\n</div>\n\nAfter\n',
      '> Before\n>\n> <div>x</div>\n>\n> After\n',
      '- <div>x</div>\n- y\n',
      '- Before\n\n  <div>x</div>\n\n  After\n',
      'a<em>b</em>c\n',
    ]) {
      expect(shape(roundTrip(src))).toEqual(shape(md2ast(src)))
    }
  })
})
