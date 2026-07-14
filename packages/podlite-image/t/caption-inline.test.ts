import { podlitePluggable, PodliteDocument } from '@podlite/schema'
import Image from '../src/index'

const parse = (str: string): PodliteDocument => {
  const podlite = podlitePluggable().use({ Image, picture: Image })
  return podlite.toAst(podlite.parse(str))
}

const findCaption = (node: any): any => {
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = findCaption(n)
      if (found) return found
    }
    return null
  }
  if (!node || typeof node !== 'object') return null
  if (node.name === 'caption') return node
  if (node.content) return findCaption(node.content)
  return null
}

const captionOf = (str: string) => findCaption(parse(str))

describe('picture caption is parsed as inline content', () => {
  it('keeps a block directive name as literal text instead of swallowing the caption', () => {
    const caption = captionOf(`=for picture :caption('=data-table — CSV in, table out')\nimg.png`)
    expect(caption).toBeTruthy()
    const dump = JSON.stringify(caption.content)
    expect(dump).toContain('=data-table — CSV in, table out')
    expect(dump).not.toContain('"name":"table"')
  })

  it('resolves formatting codes in the caption', () => {
    const caption = captionOf(`=for picture :caption('B<bold> label')\nimg.png`)
    const bold = caption.content.find((n: any) => n.type === 'fcode' && n.name === 'B')
    expect(bold).toBeTruthy()
  })

  it('resolves entities in the caption', () => {
    const caption = captionOf(`=for picture :caption('E<lt>x')\nimg.png`)
    const entity = caption.content.find((n: any) => n.type === 'fcode' && n.name === 'E')
    expect(entity).toBeTruthy()
  })
})
