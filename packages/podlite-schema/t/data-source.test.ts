import { podlitePluggable, toHtml, resolveDataImages, resolveDataSource, dataKeyOf, imageAddress } from '../src'
import * as fs from 'fs'
import * as path from 'path'

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC'
const URL = `data:image/png;base64,${PNG}`
const logo = (attrs = '') => `=begin data :key<Logo> :mime-type<image/png> :encoding<base64>${attrs}\n${PNG}\n=end data`

const bare = (src: string): any => {
  const p = podlitePluggable()
  return p.toAst(p.parse(`=begin pod\n${src}\n=end pod\n`, { podMode: 1 }))
}

const imagesOf = (tree: any): any[] => {
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

describe('a data: picture in an instance with no plugins', () => {
  it('gets its address from the core, and the core writes it', () => {
    const tree = bare(`=para A P<logo|data:Logo> here.\n\n${logo()}`)
    const [image] = imagesOf(tree)
    expect(image.src).toBe('data:Logo')
    expect(image.dataUrl).toBe(URL)
    expect(toHtml({}).run(tree).toString()).toContain(`src="${URL}"`)
  })

  it('keeps what a toAst rule of the root returned and wrote', () => {
    const p = podlitePluggable()
    p.use({
      root: {
        toAst: writer => node => {
          writer.write('first')
          return node
        },
      },
    })
    const result = p.toAstResult(
      p.parse('=begin pod\n=para P<a|https://example.org/a.png>\n=end pod\n', { podMode: 1 }),
    )
    expect(result.toString()).toBe('first')
  })
})

describe('resolveDataImages', () => {
  it('computes both fields again on a second walk', () => {
    const tree = bare(`=para P<logo|data:Logo>\n\n${logo(' :masked')}`)
    const [image] = imagesOf(tree)
    expect(image.dataUrl).toBe(URL)
    expect(image.dataGuarded).toBe(true)
    image.src = 'local.png'
    resolveDataImages(tree)
    expect(image.dataUrl).toBeUndefined()
    expect(image.dataGuarded).toBeUndefined()
  })

  it('drops the cover of the block when an open block takes its place', () => {
    const tree = bare(`=para P<logo|data:Logo>\n\n${logo(' :masked')}`)
    const data = tree.content[0].content.find((n: any) => n.name === 'data')
    delete data.guarded
    data.config = data.config.filter((c: any) => c.name !== 'masked')
    resolveDataImages(tree)
    expect(imagesOf(tree)[0].dataGuarded).toBeUndefined()
  })

  it('visits each node of the tree once in each of its two walks, however many pictures it holds', () => {
    for (const count of [50, 200]) {
      const pictures = Array.from({ length: count }, (_, i) => `=para P<p${i}|data:Logo>`).join('\n\n')
      const tree = bare(`${pictures}\n\n${logo()}`)
      let nodes = 0
      const count_ = (node: any) => {
        if (Array.isArray(node)) return node.forEach(count_)
        if (!node || typeof node !== 'object') return
        nodes++
        if (node.content && typeof node.content === 'object') count_(node.content)
        if (node.caption && typeof node.caption === 'object') count_(node.caption)
      }
      count_(tree)
      const stats = { visited: 0 }
      resolveDataImages(tree, stats)
      expect(stats.visited).toBe(2 * nodes)
    }
  })
})

describe('resolveDataSource and dataKeyOf', () => {
  it('give the data URL of the first block with the key', () => {
    expect(resolveDataSource(bare(logo()), 'Logo')).toEqual({ url: URL, covered: false })
    expect(resolveDataSource(bare(logo()), 'Other')).toBeNull()
  })

  it('read only a reference by key', () => {
    expect(dataKeyOf('data:Logo')).toBe('Logo')
    expect(dataKeyOf('data:Logo;2')).toBe('Logo;2')
    expect(dataKeyOf(`data:image/png;base64,${PNG}`)).toBeNull()
    expect(dataKeyOf('data:Logo#x')).toBeNull()
    expect(dataKeyOf('data:')).toBeNull()
    expect(dataKeyOf('DATA:Logo')).toBeNull()
    expect(dataKeyOf(42)).toBeNull()
  })
})

describe('imageAddress', () => {
  const node = { src: 'data:Logo', dataUrl: URL }
  it('gives the data URL, and src when told to give the text as written', () => {
    expect(imageAddress(node, {})).toBe(URL)
    expect(imageAddress(node, { asWritten: true })).toBe('data:Logo')
    expect(imageAddress({ src: 'local.png' }, {})).toBe('local.png')
  })

  it('gives src for a covered block outside draft mode, and for a picture covered by its own mark', () => {
    expect(imageAddress({ ...node, dataGuarded: true }, {})).toBe('data:Logo')
    expect(imageAddress({ ...node, dataGuarded: true }, { renderMode: 'draft' })).toBe(URL)
    expect(imageAddress({ ...node, dataGuarded: true }, { renderMode: 'draft', maskMode: true })).toBe('data:Logo')
    expect(imageAddress({ ...node, guarded: true }, {})).toBe('data:Logo')
  })
})

describe('the schema of a picture', () => {
  for (const name of ['AstTree.json', 'PodliteDocument.json']) {
    it(`describes the computed fields and the picture of P<> in ${name}`, () => {
      const defs = JSON.parse(fs.readFileSync(path.join(__dirname, '../schema', name), 'utf8')).definitions
      expect(defs.Image.properties.dataUrl).toEqual({ type: 'string' })
      expect(defs.Image.properties.dataGuarded).toEqual({ type: 'boolean' })
      expect(defs.FormattingCodeP.properties.content.items).toEqual({ $ref: '#/definitions/Image' })
    })
  }
})
