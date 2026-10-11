import { podlite } from '../../core/src'
import { runSelector } from '../src/selectors'

const read = (body: string) => {
  const p = podlite({ importPlugins: true })
  const ast = p.toAst(p.parse(`=begin pod\n${body}\n=end pod\n`, { podMode: 1 }))
  const items: any[] = []
  const walk = (node: any) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== 'object') return
    if (node.type === 'block' && node.name === 'item') items.push(node)
    walk(node.content)
  }
  walk(ast)
  const item = items[0]
  return {
    item,
    numbered: (item.config ?? []).filter((c: any) => c.name === 'numbered'),
    selected: runSelector('item[ :numbered ]', [{ file: 'x.podlite', node: ast }]).length,
    html: p.toHtml(ast).toString(),
  }
}

describe('an item whose first word is not a single #', () => {
  for (const text of ['#Hashtag topic', '## twice']) {
    it(`leaves "${text}" unnumbered and as written`, () => {
      const { item, numbered, selected, html } = read(`=item ${text}`)
      expect(selected).toBe(0)
      expect(numbered).toEqual([])
      expect(item.content[0].text).toBe(`${text}\n`)
      expect(html).toContain('<ul>')
      expect(html).toContain(text)
    })
  }

  it('keeps its :id and stays unnumbered', () => {
    const { selected, html } = read('=for item :id<x>\n#Hashtag topic')
    expect(selected).toBe(0)
    expect(html).toContain('<li id="x">')
    expect(html).toContain('<ul>')
  })
})

describe('an item marked :!numbered', () => {
  it('keeps a leading # as text', () => {
    const { item, numbered, selected, html } = read('=for item :!numbered\n# introduces a comment')
    expect(selected).toBe(0)
    expect(numbered).toEqual([expect.objectContaining({ value: false })])
    expect(item.content[0].text).toBe('# introduces a comment\n')
    expect(html).toContain('# introduces a comment')
  })
})

describe('an item whose first word is a single #', () => {
  it('is numbered once over a :!numbered given by =set', () => {
    const { numbered, selected, html } = read('=set :!numbered\n=item # real')
    expect(selected).toBe(1)
    expect(numbered).toHaveLength(1)
    expect(html).toContain('<ol>')
    expect(html).not.toContain('#')
  })

  it('is numbered in the abbreviated and paragraph forms', () => {
    for (const body of ['=item # real', '=for item\n# real']) {
      const { selected, html } = read(body)
      expect(selected).toBe(1)
      expect(html).toContain('<ol>')
      expect(html).not.toContain('#')
    }
  })

  it('keeps a checkbox before the #', () => {
    const { selected, html } = read('=item [x] # real')
    expect(selected).toBe(1)
    expect(html).toContain('checked')
    expect(html).not.toContain('#')
  })
})

describe('an item numbered or left as written by other means', () => {
  it('keeps a verbatim #', () => {
    const { selected, html } = read('=item V<#> introduces a comment')
    expect(selected).toBe(0)
    expect(html).toContain('<ul>')
    expect(html).toContain('# introduces a comment')
  })

  it('numbers items by =config', () => {
    expect(read('=config item :numbered\n\n=item plain').html).toContain('<ol>')
  })

  it('does not read a # in a code block at the start of an item', () => {
    const { selected, html } = read('=begin item\n=code # Literal\n=end item')
    expect(selected).toBe(0)
    expect(html).toContain('<ul>')
    expect(html).toContain('# Literal')
  })
})
