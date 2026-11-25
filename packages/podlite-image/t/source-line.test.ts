import { frozenIds, podlitePluggable, PodliteDocument, toMarkdown } from '@podlite/schema'
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
const image = (...lines: string[]) => ['=begin Image', ...lines, '=end Image', ''].join('\n')

describe('an =Image source is the first non-blank line, as before', () => {
  it('skips a blank line before the source', () => {
    const { image: img, caption } = pictureOf(image('', url, '', 'Caption B<here>'))
    expect(img.src).toBe(url)
    expect(caption).toContain('"name":"B"')
    expect(caption).not.toContain('example.org')
  })

  it('skips several blank lines before a source with alternative text', () => {
    const { image: img, caption } = pictureOf(image('', '', `alt text ${url}`, 'Caption'))
    expect(img.src).toBe(url)
    expect(img.alt).toBe('alt text')
    expect(caption).toContain('Caption')
    expect(caption).not.toContain('example.org')
  })

  it('skips a line of spaces and tabs', () => {
    expect(pictureOf(image(' \t ', url)).image.src).toBe(url)
  })

  it('skips a line holding only a wide space the norm counts as blank', () => {
    expect(pictureOf(image(' ', url)).image.src).toBe(url)
  })

  it('reads the first line of an =Image with :src as before', () => {
    const { image: img, caption } = pictureOf(
      ['=begin Image :src<fixed.png>', 'First caption', 'Second caption', '=end Image', ''].join('\n'),
    )
    expect(img.src).toBe('fixed.png')
    expect(img.alt).toBe('First')
    expect(caption).toContain('Second caption')
  })

  it('writes the image and keeps the address out of the caption in html', () => {
    const html = parseToHtml(image('', url, '', 'Caption B<here>'))
    expect(html).toContain(`<img src="${url}"/>`)
    const caption = html.match(/<div class="caption">([\s\S]*?)<\/div>/)
    expect(caption![1]).not.toContain('example.org')
  })
})

const contentOf = (str: string) => findBlock(parse(str)).content
const markdown = (str: string): string => {
  const podlite = podlitePluggable().use({ Image, picture: Image })
  return toMarkdown({})
    .run(podlite.toAst(podlite.parse(str)))
    .toString()
}
const fixture = [
  '=begin picture :src<orbit.svg>',
  'data:Logo',
  '',
  'The B<second> paragraph.',
  '=end picture',
  '',
].join('\n')

describe('a =picture takes its source only from :src, and its whole body is the caption', () => {
  it('keeps the first line of the body in the caption, even one that reads as an address', () => {
    const [img, caption] = contentOf(fixture)
    expect(img).toEqual({ type: 'image', src: 'orbit.svg', alt: undefined })
    expect(caption.content.map((part: any) => part.type)).toEqual(['para', 'para'])
    expect(JSON.stringify(caption.content[0])).toContain('data:Logo')
    expect(JSON.stringify(caption.content[1])).toContain('"name":"B"')
  })

  it('writes both paragraphs of the caption in html and markdown', () => {
    expect(parseToHtml(fixture)).toContain(
      '<img src="orbit.svg"/><div class="caption"><p>data:Logo</p><p>The <strong>second</strong> paragraph.</p></div>',
    )
    expect(markdown(`${fixture}\n=para After\n`)).toBe(
      '![](orbit.svg)\n\ndata:Logo\n\nThe **second** paragraph.\n\nAfter\n\n',
    )
  })

  it('gives an abbreviated picture no source, and keeps its text as the caption', () => {
    const content = contentOf('=picture data:Logo\n')
    expect(content).toHaveLength(1)
    expect(content[0].name).toBe('caption')
    expect(JSON.stringify(content[0].content)).toBe(JSON.stringify(['data:Logo\n']))
    expect(parseToHtml('=picture astronaut.png\n')).not.toContain('<img')
    expect(markdown('=picture astronaut.png\n\n=para After\n')).toBe('astronaut.png\n\nAfter\n\n')
  })

  for (const [by, declaration] of [
    ['=set', '=set :src<astronaut.png>'],
    ['=config', '=config picture :src<astronaut.png>'],
  ]) {
    it(`takes the source of an abbreviated picture from ${by}, and its text is the caption`, () => {
      const [img, caption] = contentOf(`${declaration}\n=picture The station B<at> its highest point.\n`)
      expect(img).toEqual({ type: 'image', src: 'astronaut.png', alt: undefined })
      expect(JSON.stringify(caption.content)).toContain('The station ')
      expect(JSON.stringify(caption.content)).toContain('"name":"B"')
    })
  }

  it('lets the body give the caption ahead of :caption, which stays an option of the block', () => {
    const node = findBlock(
      parse(
        ["=begin picture :src<orbit.png> :caption('Orbit')", 'First.', '', 'Second.', '=end picture', ''].join('\n'),
      ),
    )
    const caption = node.content[1]
    expect(JSON.stringify(caption)).toContain('First.')
    expect(JSON.stringify(caption)).toContain('Second.')
    expect(JSON.stringify(caption)).not.toContain('Orbit')
    expect(node.config).toContainEqual(expect.objectContaining({ name: 'caption', value: 'Orbit' }))
  })

  it('gives a picture without a source its :caption, and one with an empty source nothing', () => {
    expect(contentOf('=for picture :caption<Orbit>\n')).toEqual([
      { type: 'block', name: 'caption', content: [{ type: 'text', value: 'Orbit' }] },
    ])
    expect(contentOf("=for picture :src('')\n")).toEqual([])
    expect(contentOf(['=begin picture', '', ' \t', '=end picture', ''].join('\n'))).toEqual([])
  })

  it('keeps the body when :allow is written on the picture', () => {
    const [img, caption] = contentOf('=for picture :src<x.png> :allow<B>\nCaption B<bold> tail\n')
    expect(img.src).toBe('x.png')
    expect(JSON.stringify(caption.content)).toContain('"name":"B"')
    expect(JSON.stringify(caption.content)).toContain(' tail')
  })

  it('reads a caption of one paragraph as written, with its blank lines', () => {
    const [, caption] = contentOf(['=begin picture :src<x.png>', '', 'Caption', '=end picture', ''].join('\n'))
    expect(JSON.stringify(caption.content)).toBe(JSON.stringify(['\nCaption\n']))
  })

  it('separates the paragraphs of a caption without a source from the paragraph after it in markdown', () => {
    expect(
      markdown(['=begin picture', 'First B<bold>.', '', 'Second.', '=end picture', '', '=para After', ''].join('\n')),
    ).toBe('First **bold**.\n\nSecond.\n\nAfter\n\n')
  })
})

describe('a =picture with its source in :src keeps what it gave before', () => {
  it('takes the caption from :caption when the body holds only blank lines', () => {
    const [img, caption] = contentOf(
      ['=begin picture :src<orbit.png> :caption<Orbit>', ' \t', '', '=end picture', ''].join('\n'),
    )
    expect(img.src).toBe('orbit.png')
    expect(caption.content).toEqual([{ type: 'text', value: 'Orbit' }])
  })

  it('takes :src written on the block ahead of =set and =config, and =set ahead of =config', () => {
    const declarations = '=config picture :src<config.png>\n=set :src<set.png>\n'
    expect(contentOf(`${declarations}=for picture :src<local.png>\nCaption.\n`)[0].src).toBe('local.png')
    expect(contentOf(`${declarations}=picture Caption.\n`)[0].src).toBe('set.png')
  })
})
