import { frozenIds, podlitePluggable, PodliteDocument } from '@podlite/schema'
import Image from '../src/index'

const parse = (str: string): PodliteDocument => {
  const podlite = podlitePluggable().use({ Image, picture: Image })
  return podlite.toAst(podlite.parse(str))
}

const parseToHtml = (str: string): string => {
  const podlite = podlitePluggable().use({ Image, picture: Image })
  return podlite.toHtml(frozenIds()(podlite.toAst(podlite.parse(str)))).toString()
}

const findImages = (node: any, acc: any[] = []): any[] => {
  if (Array.isArray(node)) {
    node.forEach(n => findImages(n, acc))
    return acc
  }
  if (!node || typeof node !== 'object') return acc
  if (node.type === 'image') acc.push(node)
  if (node.content) findImages(node.content, acc)
  return acc
}

const linksOf = (str: string) => findImages(parse(str)).map(n => n.link)

describe('image link comes from its own block', () => {
  it('keeps the link given to the block', () => {
    expect(linksOf('=for Image :link<https://example.com/a>\none.png\n')).toEqual(['https://example.com/a'])
  })

  it('leaves an image without a link of its own without one', () => {
    expect(linksOf('=for Image\none.png\n')).toEqual([undefined])
  })

  it('does not pass a link on to the next image', () => {
    const source = ['=for Image :link<https://example.com/a>', 'one.png', '', '=for Image', 'two.png', ''].join('\n')
    expect(linksOf(source)).toEqual(['https://example.com/a', undefined])
  })

  it('wraps only the image that carries the link', () => {
    const source = ['=for Image :link<https://example.com/a>', 'one.png', '', '=for Image', 'two.png', ''].join('\n')
    const html = parseToHtml(source)
    expect(html.match(/<a href=/g)).toHaveLength(1)
    expect(html).toMatch(/<a href="[^"]*example[^"]*"><img src="one\.png"/)
    expect(html).toMatch(/<img src="two\.png"[^>]*\/><\/div>/)
  })

  it('does not pass a link on to a picture below', () => {
    const source = [
      '=for Image :link<https://example.com/a>',
      'one.png',
      '',
      '=begin picture',
      'two.png',
      '=end picture',
      '',
    ].join('\n')
    expect(linksOf(source)).toEqual(['https://example.com/a', undefined])
  })
})
