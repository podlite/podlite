import { podlitePluggable } from '../src/pluggableParser'
import { toHtml, toMarkdown } from '../src'

const parsed = (src: string) => podlitePluggable().parse(src, { podMode: 1 })

const findBlock = (node: any, name: string): any => {
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = findBlock(n, name)
      if (found) return found
    }
    return null
  }
  if (!node || typeof node !== 'object') return null
  if (node.type === 'block' && node.name === name) return node
  if (node.content) return findBlock(node.content, name)
  return null
}

const codesIn = (node: any): string[] => {
  if (Array.isArray(node)) return node.flatMap(codesIn)
  if (!node || typeof node !== 'object') return []
  return [...(node.type === 'fcode' ? [node.name] : []), ...codesIn(node.content)]
}

const tableOf = (set: string) => findBlock(parsed(`${set}\n=begin table\na  b\n=end table\n`), 'table')

describe('a caption =set gives', () => {
  it('is read for markup codes in both forms of =set', () => {
    for (const set of ['=set :caption Scheme of B<orbit>', "=set :caption('Scheme of B<orbit>')"]) {
      const table = tableOf(set)
      expect(table.caption).toMatchObject({ type: 'block', name: 'caption' })
      expect(codesIn(table.caption)).toEqual(['B'])
    }
  })

  it('keeps its value a string for selectors', () => {
    const item = tableOf('=set :caption Scheme of B<orbit>').config.find((c: any) => c.name === 'caption')
    expect(item).toMatchObject({ value: 'Scheme of B<orbit>', from: 'set' })
  })

  it('is found after another attribute', () => {
    expect(codesIn(tableOf("=set :id<x> :caption('Scheme B<x>')").caption)).toEqual(['B'])
  })

  it('reads the first value of a list', () => {
    expect(codesIn(tableOf("=set :caption('B<orbit>', 'other')").caption)).toEqual(['B'])
  })

  it('gives nothing when it holds no code', () => {
    expect(tableOf('=set :caption Plain words')).not.toHaveProperty('caption')
  })

  it('is read for a picture, whose body is not', () => {
    const picture = findBlock(parsed('=set :caption Scheme of B<orbit>\n=for picture\na.png\n'), 'picture')
    expect(codesIn(picture.caption)).toEqual(['B'])
  })

  it('reads entities inside C<> only where =config allows them', () => {
    const doc = (config: string) =>
      String(toHtml({}).run(parsed(`${config}=set :caption Scheme C<E<lt>> x\n=begin table\na  b\n=end table\n`)))
    expect(doc('=config C<> :allow<E>\n\n')).toContain('<caption>Scheme <code>&lt;</code> x</caption>')
    expect(doc('')).toContain('<caption>Scheme <code>E&lt;lt&gt;</code> x</caption>')
  })
})

describe('the caption of a table in markdown', () => {
  const md = (src: string) => String(toMarkdown({}).run(parsed(src)))

  it('stands as a paragraph when =set gives it with codes, so its own bold shows', () => {
    const out = md(
      '=set :caption Selected B<chemical> elements with their\n=          L<atomic numbers|#elements> and symbols\n\n=begin table\nA | B\n=end table\n',
    )
    expect(out).toContain('Selected **chemical** elements with their')
    expect(out).not.toContain('**Selected')
  })

  it('stays in bold when it holds no code, written on the table or given by =set', () => {
    expect(md('=set :caption Plain\n=begin table\nA | B\n=end table\n')).toContain('**Plain**')
    expect(md("=begin table :caption('Own B<two>')\nA | B\n=end table\n")).toContain('**Own B<two>**')
  })
})

describe('a caption written on the block', () => {
  it('is not read for codes', () => {
    const table = findBlock(parsed("=begin table :caption('Scheme of B<orbit>')\na  b\n=end table\n"), 'table')
    expect(table).not.toHaveProperty('caption')
  })

  it('outranks one =set gives, and stays text', () => {
    const table = findBlock(
      parsed("=set :caption Set B<one>\n=begin table :caption('Own B<two>')\na  b\n=end table\n"),
      'table',
    )
    expect(table).not.toHaveProperty('caption')
  })
})

describe('the tree schema', () => {
  it('describes the caption of a block', () => {
    const schema = require('../schema/AstTree.json')
    const definitions = schema.definitions || {}
    expect(definitions.BlockTable.properties.caption).toEqual({ $ref: '#/definitions/BlockCaption' })
    expect(definitions.BlockPicture.properties.caption).toEqual({ $ref: '#/definitions/BlockCaption' })
  })
})
