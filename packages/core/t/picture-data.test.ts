import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { toHtml, toMarkdown } from '@podlite/schema'
import { podlite } from '../src/index'
import { podliteText } from '../src/query-blocks'

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC'
const OTHER = 'iVBORw0KGgoAAAANSUhEUgAAAAMAAAAFCAYAAACAcVaiAAAAS0lEQVR4AWPOPfjpvWZSW4db'
const logo = (attrs = '', body = PNG, key = 'Logo') =>
  `=begin data :key<${key}> :mime-type<image/png> :encoding<base64>${attrs ? ' ' + attrs : ''}\n${body}\n=end data`

const build = (src: string) => {
  const p = podlite({ importPlugins: true })
  return p.toAst(p.parse(`=begin pod\n${src}\n=end pod\n`, { podMode: 1 }))
}
const html = (src: string, renderMode = 'production') => toHtml({ renderMode }).run(build(src)).toString()
const md = (src: string, renderMode = 'production') => toMarkdown({ renderMode }).run(build(src)).toString()
const images = (out: string) => out.match(/<img[^>]*>/g) || []
const urls = (out: string) => out.match(/data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g) || []
const bytesOf = (url: string) => Buffer.from(url.split(',')[1], 'base64')

const findImages = (tree: any): any[] => {
  const found: any[] = []
  const walk = (node: any) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== 'object') return
    if (node.type === 'image') found.push(node)
    if (node.content && typeof node.content === 'object') walk(node.content)
    if (node.caption && typeof node.caption === 'object') walk(node.caption)
  }
  walk(tree)
  return found
}

describe('a picture whose source is a data: reference', () => {
  it('takes the bytes of the =data block written after it, in HTML and Markdown', () => {
    const src = `=for picture :src<data:Logo>\n\n${logo()}`
    const [url] = urls(html(src))
    expect(url.startsWith('data:image/png;base64,')).toBe(true)
    expect(bytesOf(url).equals(Buffer.from(PNG, 'base64'))).toBe(true)
    expect(bytesOf(urls(md(src))[0]).equals(Buffer.from(PNG, 'base64'))).toBe(true)
  })

  it('takes the bytes of the =data block written before it', () => {
    const src = `${logo()}\n\n=for picture :src<data:Logo>`
    expect(bytesOf(urls(html(src))[0]).equals(Buffer.from(PNG, 'base64'))).toBe(true)
    expect(bytesOf(urls(md(src))[0]).equals(Buffer.from(PNG, 'base64'))).toBe(true)
  })

  it('keeps the written source in src and puts the address beside it', () => {
    const [image] = findImages(build(`=for picture :src<data:Logo>\n\n${logo()}`))
    expect(image.src).toBe('data:Logo')
    expect(image.dataUrl).toBe(`data:image/png;base64,${PNG}`)
    expect(image.dataGuarded).toBeUndefined()
  })

  it('resolves P<> in a paragraph, in a table cell and in a table caption given by =set', () => {
    const src = [
      '=para A P<logo|data:Logo> here.',
      '=begin table\nP<cell|data:Logo> | b\n=end table',
      '=set :caption P<cap|data:Logo>\n=begin table\nx | y\n=end table',
      logo(),
    ].join('\n\n')
    const out = html(src)
    expect(urls(out)).toHaveLength(3)
    expect(images(out).every(tag => tag.includes(`data:image/png;base64,${PNG}`))).toBe(true)
  })

  it('resolves a picture in the caption of a table of contents given by =set', () => {
    const src = `=set :caption Contents P<toccap|data:Logo>\n=for toc\nhead1\n\n=head1 Topic\n\n${logo()}`
    const tree = build(src)
    expect(findImages(tree).some(image => image.dataUrl === `data:image/png;base64,${PNG}`)).toBe(true)
    expect(urls(html(src))).toHaveLength(1)
  })

  it('resolves a Markdown image inside =begin markdown', () => {
    const src = `=begin markdown\n![md](data:Logo)\n=end markdown\n\n${logo()}`
    expect(md(src)).toContain(`![md](data:image/png;base64,${PNG})`)
  })

  it('encodes a text type written without :encoding from its UTF-8 bytes', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>Łódź</text></svg>'
    const src = `=for picture :src<data:Icon>\n\n=begin data :key<Icon> :mime-type<image/svg+xml>\n${svg}\n=end data`
    const [url] = urls(html(src))
    expect(url.startsWith('data:image/svg+xml;base64,')).toBe(true)
    expect(bytesOf(url).toString('utf8')).toBe(`${svg}\n`)
  })

  it('takes the type from the last extension of :filename when no :mime-type is written', () => {
    const src = `=for picture :src<data:Logo>\n\n=begin data :key<Logo> :filename<logo.jpg.PNG> :encoding<base64>\n${PNG}\n=end data`
    expect(urls(html(src))[0].startsWith('data:image/png;base64,')).toBe(true)
  })

  it('lets an explicit type win over the file name and drops its parameters', () => {
    const src = `=for picture :src<data:Logo>\n\n=begin data :key<Logo> :filename<logo.jpg> :mime-type('IMAGE/PNG; charset=x') :encoding<base64>\n${PNG}\n=end data`
    expect(urls(html(src))[0].startsWith('data:image/png;base64,')).toBe(true)
  })

  it('reads a key with a semicolon and compares keys exactly', () => {
    expect(urls(html(`=for picture :src<data:Logo;2>\n\n${logo('', PNG, 'Logo;2')}`))).toHaveLength(1)
    expect(urls(html(`=for picture :src<data:logo>\n\n${logo()}`))).toHaveLength(0)
  })

  it('takes the first of two blocks with one key', () => {
    const src = `=for picture :src<data:Logo>\n\n${logo()}\n\n${logo('', OTHER)}`
    expect(bytesOf(urls(html(src))[0]).equals(Buffer.from(PNG, 'base64'))).toBe(true)
  })

  it('carries the body after its spaces are taken out, padding bits as written', () => {
    for (const body of ['AB==', 'AAB=', 'AA AA\nAA==']) {
      const src = `=for picture :src<data:Logo>\n\n${logo('', body)}`
      expect(urls(html(src))[0]).toBe(`data:image/png;base64,${body.replace(/\s+/g, '')}`)
    }
  })

  it('writes the data URL through the HTML of the picture plugin', () => {
    const p = podlite({ importPlugins: true })
    const out = String(
      p.toHtml(p.toAst(p.parse(`=begin pod\n=for picture :src<data:Logo>\n\n${logo()}\n=end pod\n`, { podMode: 1 }))),
    )
    expect(out).toContain(`src="data:image/png;base64,${PNG}"`)
  })
})

describe('a data: picture whose block is covered', () => {
  const cases = {
    'by its own :masked': `=for picture :src<data:Logo> :alt<seen>\n\n${logo(':masked')}`,
    'by =config': `=config data :masked\n\n=for picture :src<data:Logo> :alt<seen>\n\n${logo()}`,
    'by a masked container': `=for picture :src<data:Logo> :alt<seen>\n\n=begin nested :masked\n${logo()}\n=end nested`,
  }
  for (const [how, src] of Object.entries(cases)) {
    it(`writes no bytes in production and the picture in draft when covered ${how}`, () => {
      expect(urls(html(src))).toHaveLength(0)
      expect(images(html(src))[0]).toContain('src="data:Logo"')
      expect(urls(md(src))).toHaveLength(0)
      expect(urls(html(src, 'draft'))).toHaveLength(1)
      expect(urls(md(src, 'draft'))).toHaveLength(1)
    })
  }

  it('does not mask the alternative text the author wrote', () => {
    expect(images(html(cases['by its own :masked']))[0]).toContain('alt="seen"')
  })

  it('reads a block open by :!masked under a masking =config', () => {
    const src = `=config data :masked\n\n=for picture :src<data:Logo>\n\n${logo(':!masked')}`
    expect(urls(html(src))).toHaveLength(1)
  })
})

describe('a data: reference left as written', () => {
  const kept = {
    'a key with no block': '=for picture :src<data:Missing>',
    'a ready data URL': `=for picture :src<data:image/png;base64,${PNG}>`,
    'an address with a column': `=for picture :src<data:Logo#x>\n\n${logo()}`,
    'an upper-case scheme': `=for picture :src<DATA:Logo>\n\n${logo()}`,
    'an empty key': `=for picture :src<data:>\n\n${logo()}`,
    'a key with a comma': `=for picture :src<data:Logo,2>\n\n${logo('', PNG, 'Logo,2')}`,
    'a binary type without :encoding': `=for picture :src<data:Logo>\n\n=begin data :key<Logo> :mime-type<image/png>\n${PNG}\n=end data`,
    'an encoding other than base64': `=for picture :src<data:Logo>\n\n=begin data :key<Logo> :mime-type<image/png> :encoding<hex>\n00ff\n=end data`,
    'no type and no file name': `=for picture :src<data:Logo>\n\n=begin data :key<Logo> :encoding<base64>\n${PNG}\n=end data`,
    'an empty explicit type': `=for picture :src<data:Logo>\n\n=begin data :key<Logo> :mime-type() :filename<logo.png> :encoding<base64>\n${PNG}\n=end data`,
    'a type without a slash': `=for picture :src<data:Logo>\n\n=begin data :key<Logo> :mime-type<image> :encoding<base64>\n${PNG}\n=end data`,
    'a type that opens the body': `=for picture :src<data:Logo>\n\n=begin data :key<Logo> :mime-type('image/png,x') :encoding<base64>\n${PNG}\n=end data`,
    'a type that opens a fragment': `=for picture :src<data:Logo>\n\n=begin data :key<Logo> :mime-type('image/x-png#p') :encoding<base64>\n${PNG}\n=end data`,
  }
  for (const [what, src] of Object.entries(kept)) {
    it(`computes no address for ${what}`, () => {
      const found = findImages(build(src))
      expect(found.length).toBeGreaterThan(0)
      expect(found.every(image => image.dataUrl === undefined)).toBe(true)
    })
  }

  for (const body of ['A', 'AA=A', 'AAAA====', 'AAA!']) {
    it(`computes no address for the body ${body}`, () => {
      expect(findImages(build(`=for picture :src<data:Logo>\n\n${logo('', body)}`))[0].dataUrl).toBeUndefined()
    })
  }

  it('leaves file and remote sources as they were', () => {
    const out = html('=picture local.png\n\n=para P<r|https://example.org/r.png>')
    expect(images(out)[0]).toContain('src="local.png"')
    expect(images(out)[1]).toContain('src="https://example.org/r.png"')
  })

  it('does not fail on a picture with no source and on a source that is not a string', () => {
    expect(() => html('=begin picture\n=end picture')).not.toThrow()
    expect(() => html('=for picture :src(42)')).not.toThrow()
  })
})

describe('the text of a picture block as its file holds it', () => {
  it('gives the written reference, not the bytes', () => {
    const tree = build(`=begin markdown\n![md](data:Logo)\n=end markdown\n\n${logo()}`)
    const [image] = findImages(tree)
    expect(image.dataUrl).toBeDefined()
    const block = { type: 'block', name: 'Image', margin: '', content: [image] }
    const text = podliteText(block, '', new WeakMap([[block, {}]]))
    expect(text).toContain('data:Logo')
    expect(text).not.toContain(PNG)
  })
})

describe('podlite convert', () => {
  const cli = path.join(__dirname, '../bin/podlite.js')
  const convert = (src: string, to: string) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'picture-data-'))
    const file = path.join(dir, 'doc.podlite')
    fs.writeFileSync(file, `=begin pod\n${src}\n=end pod\n`)
    return execFileSync('node', [cli, 'convert', file, '--to', to, '-o', '-'], { encoding: 'utf8' })
  }

  it('writes the address of a picture with its block before and after it', () => {
    for (const src of [`=for picture :src<data:Logo>\n\n${logo()}`, `${logo()}\n\n=for picture :src<data:Logo>`]) {
      for (const to of ['html', 'md']) {
        const found = urls(convert(src, to))
        expect(found).toHaveLength(1)
        expect(found[0].startsWith('data:image/png;base64,')).toBe(true)
        expect(bytesOf(found[0]).equals(Buffer.from(PNG, 'base64'))).toBe(true)
      }
    }
  })
})
