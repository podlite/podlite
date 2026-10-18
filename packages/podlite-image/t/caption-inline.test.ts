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

  it('resolves formatting codes in a caption =set gives', () => {
    for (const set of ['=set :caption B<bold> label', "=set :caption('B<bold> label')"]) {
      const caption = captionOf(`${set}\n=for picture\nimg.png`)
      const bold = caption.content.find((n: any) => n.type === 'fcode' && n.name === 'B')
      expect(bold).toBeTruthy()
    }
  })

  it('resolves entities in a caption =set gives', () => {
    const caption = captionOf(`=set :caption E<lt>x\n=for picture\nimg.png`)
    const entity = caption.content.find((n: any) => n.type === 'fcode' && n.name === 'E')
    expect(entity).toBeTruthy()
  })

  it('reads the first value of a list =set gives, as before', () => {
    const caption = captionOf(`=set :caption('B<orbit>', 'other')\n=for picture\nimg.png`)
    expect(caption.content.some((n: any) => n.type === 'fcode' && n.name === 'B')).toBe(true)
  })

  it('takes a caption written on the picture for text', () => {
    const caption = captionOf(`=for picture :caption('Scheme of B<orbit> E<lt>')\nimg.png`)
    expect(caption.content).toEqual([{ type: 'text', value: 'Scheme of B<orbit> E<lt>' }])
  })

  it('reads the codes of the caption under the source line', () => {
    const caption = captionOf(`=begin picture\nimg.png\nScheme of B<orbit>\n=end picture`)
    expect(caption.content.some((n: any) => n.type === 'fcode' && n.name === 'B')).toBe(true)
  })
})
