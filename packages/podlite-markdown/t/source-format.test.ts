import { md2ast } from '../src/tools'

const blocksOf = (node: any, out: any[] = []): any[] => {
  if (Array.isArray(node)) node.forEach(item => blocksOf(item, out))
  else if (node && typeof node === 'object') {
    if (node.type === 'block') out.push(node)
    if (node.content) blocksOf(node.content, out)
  }
  return out
}

describe('the mark of markdown on the blocks the reader makes', () => {
  it('marks every block, the root, a table with its rows and cells and HTML in a paragraph', () => {
    const tree = md2ast('# Head\n\nText <br> more\n\n| a | b |\n| - | - |\n| x<br>y | **c** |\n\n> <div>q</div>\n')
    const blocks = blocksOf(tree)
    expect(blocks.map(block => block.name)).toEqual(
      expect.arrayContaining(['root', 'head', 'Html', 'table', 'row', 'cell', 'nested']),
    )
    expect(blocks.filter(block => block.sourceFormat !== 'markdown')).toEqual([])
  })

  it('marks HTML under a list, an emphasis and a link', () => {
    const tree = md2ast('- a <b>x</b>\n\n*a <i>y</i>*\n\n[<img src="b.svg">](https://example.org/)\n')
    const html = blocksOf(tree).filter(block => block.name === 'Html')
    expect(html).toHaveLength(5)
    expect(html.every(block => block.sourceFormat === 'markdown')).toBe(true)
  })

  it('leaves the text of a paragraph as it was', () => {
    const tree: any = md2ast('Text <br> more\n')
    const para = tree.content[0]
    expect(para.type).toBe('para')
    expect(para.sourceFormat).toBeUndefined()
    expect(para.content.map((part: any) => typeof part)).toEqual(['string', 'object', 'string'])
  })
})
