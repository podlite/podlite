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

const findBlock = (node: any): any => {
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = findBlock(n)
      if (found) return found
    }
    return null
  }
  if (!node || typeof node !== 'object') return null
  if (node.type === 'block' && (node.name === 'picture' || node.name === 'Image')) return node
  if (node.content) return findBlock(node.content)
  return null
}

const pictureOf = (str: string) => {
  const content = findBlock(parse(str)).content
  const caption = content.find((n: any) => n.name === 'caption')
  return { image: content[0], caption: caption ? JSON.stringify(caption.content) : undefined }
}

const url = 'https://example.org/x.png'
const picture = (...lines: string[]) => ['=begin picture', ...lines, '=end picture', ''].join('\n')

describe('picture source is the first non-blank line', () => {
  it('skips a blank line before the source', () => {
    const { image, caption } = pictureOf(picture('', url, '', 'Caption B<here>'))
    expect(image.src).toBe(url)
    expect(caption).toContain('"name":"B"')
    expect(caption).not.toContain('example.org')
  })

  it('skips several blank lines before a source with alternative text', () => {
    const { image, caption } = pictureOf(picture('', '', `alt text ${url}`, 'Caption'))
    expect(image.src).toBe(url)
    expect(image.alt).toBe('alt text')
    expect(caption).toContain('Caption')
    expect(caption).not.toContain('example.org')
  })

  it('skips a line of spaces and tabs', () => {
    expect(pictureOf(picture(' \t ', url)).image.src).toBe(url)
  })

  it('skips a line holding only a wide space the norm counts as blank', () => {
    expect(pictureOf(picture('\u2003', url)).image.src).toBe(url)
  })

  it('skips a blank line in an Image block', () => {
    const source = ['=begin Image', '', url, 'Caption', '=end Image', ''].join('\n')
    expect(pictureOf(source).image.src).toBe(url)
  })

  it('gives a picture with :src the same result with a blank line before its text', () => {
    const plain = pictureOf(
      ['=begin picture :src<fixed.png>', 'First caption', 'Second caption', '=end picture', ''].join('\n'),
    )
    const blank = pictureOf(
      ['=begin picture :src<fixed.png>', '', 'First caption', 'Second caption', '=end picture', ''].join('\n'),
    )
    expect(blank.image.src).toBe('fixed.png')
    expect(blank.image.alt).toBe('First')
    expect(blank.caption).toContain('Second caption')
    expect(blank.caption).not.toContain('First caption')
    expect(blank).toEqual(plain)
  })

  it('writes the image and keeps the address out of the caption in html', () => {
    const html = parseToHtml(picture('', url, '', 'Caption B<here>'))
    expect(html).toContain(`<img src="${url}"/>`)
    const caption = html.match(/<div class="caption">([\s\S]*?)<\/div>/)
    expect(caption).toBeTruthy()
    expect(caption![1]).not.toContain('example.org')
    expect(caption![1]).not.toContain('x.png')
  })

  it('keeps a picture without blank lines as it was', () => {
    const { image, caption } = pictureOf(picture(url, 'Caption B<here>'))
    expect(image.src).toBe(url)
    expect(caption).toContain('"name":"B"')
  })

  it('keeps a blank line between the source and the caption', () => {
    const { image, caption } = pictureOf(picture(url, '', 'Caption'))
    expect(image.src).toBe(url)
    expect(caption).toContain('Caption')
  })

  it('keeps a caption of two paragraphs', () => {
    const { caption } = pictureOf(picture(url, 'First para.', '', 'Second para.'))
    expect(caption).toContain('First para.')
    expect(caption).toContain('Second para.')
  })

  it('reads the first line of a picture with :src as before', () => {
    const { image, caption } = pictureOf(
      ['=begin picture :src<fixed.png>', 'First caption', 'Second caption', '=end picture', ''].join('\n'),
    )
    expect(image.src).toBe('fixed.png')
    expect(image.alt).toBe('First')
    expect(caption).toContain('Second caption')
  })

  it('keeps a picture of blank lines only as it was', () => {
    const { image, caption } = pictureOf(picture('', '', ''))
    expect(image.src).toBeUndefined()
    expect(caption).toBe(JSON.stringify(['\n\n']))
  })
})
