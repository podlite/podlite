import { md2ast } from '../src/tools'

const nodesOf = (node: any, out: any[] = []): any[] => {
  if (Array.isArray(node)) node.forEach(item => nodesOf(item, out))
  else if (node && typeof node === 'object') {
    out.push(node)
    if (node.content) nodesOf(node.content, out)
  }
  return out
}
const htmlOf = (src: string) => nodesOf(md2ast(src)).filter(node => node.name === 'Html')

describe('what the reader of markdown keeps in the tree', () => {
  it('makes a rule between blocks a boundary', () => {
    const tree: any = md2ast('a\n\n---\n\nb\n')
    expect(tree.content.map((node: any) => node.name || node.type)).toEqual(['para', 'boundary', 'para'])
    const [boundary] = tree.content.filter((node: any) => node.name === 'boundary')
    expect(boundary).toMatchObject({ type: 'block', content: [], config: [], sourceFormat: 'markdown' })
    expect(boundary.location.start.line).toBe(3)
  })

  it('makes a hard line break S<> holding a line break, written either way', () => {
    for (const src of ['a  \nb\n', 'a\\\nb\n']) {
      const [para]: any = (md2ast(src) as any).content
      expect(para.content).toEqual(['a', { type: 'fcode', name: 'S', content: ['\n'] }, 'b'])
    }
  })

  it('keeps the title of a picture on the picture and makes no caption of it', () => {
    const image = (src: string) => nodesOf(md2ast(src)).find(node => node.type === 'image')
    expect(image('![alt](x.png "Tip")\n')).toMatchObject({ src: 'x.png', alt: 'alt', title: 'Tip' })
    expect(nodesOf(md2ast('![alt](x.png "Tip")\n')).some(node => node.name === 'caption')).toBe(false)
    expect(image('![a](x)\n')).not.toHaveProperty('title')
  })

  it('tells HTML of a line from HTML of a block by where it stands', () => {
    const kinds = (src: string) => htmlOf(src).map(node => node.markdownHtml)
    expect(kinds('a<br>b\n')).toEqual(['inline'])
    expect(kinds('Before\n\n<br>\n\nAfter\n')).toEqual(['block'])
    expect(kinds('# h <b>x</b>\n')).toEqual(['inline', 'inline'])
    expect(kinds('**s <b>x</b>** *e <i>y</i>* ~~d <s>z</s>~~\n')).toEqual(Array(6).fill('inline'))
    expect(kinds('[l <b>k</b>](u) [m <b>n</b>][r]\n\n[r]: x\n')).toEqual(Array(4).fill('inline'))
    expect(kinds('| a | b |\n| - | - |\n| x<br>y | c |\n')).toEqual(['inline'])
    expect(kinds('> <div>q</div>\n')).toEqual(['block'])
    expect(kinds('- <div>x</div>\n- a <b>y</b>\n\n- <br>\n')).toEqual(['block', 'inline', 'inline', 'block'])
    expect(kinds('a<i\nclass="x">b</i>c\n')).toEqual(['inline', 'inline'])
  })
})
