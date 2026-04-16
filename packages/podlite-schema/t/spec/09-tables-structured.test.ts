import { parse, toTree, toHtml } from '../../src'

function findNodeByName(tree: unknown, name: string): unknown {
  if (!tree || typeof tree !== 'object') return null
  const n = tree as { name?: string; content?: unknown[] }
  if (n.name === name) return n
  if (Array.isArray((tree as { content?: unknown[] }).content)) {
    for (const c of (tree as { content: unknown[] }).content) {
      const found = findNodeByName(c, name)
      if (found) return found
    }
  }
  if (Array.isArray(tree)) {
    for (const c of tree as unknown[]) {
      const found = findNodeByName(c, name)
      if (found) return found
    }
  }
  return null
}

function collectNodesByName(tree: unknown, name: string, out: unknown[] = []): unknown[] {
  if (!tree || typeof tree !== 'object') return out
  const n = tree as { name?: string; content?: unknown[] }
  if (n.name === name) out.push(n)
  if (Array.isArray(n.content)) n.content.forEach(c => collectNodesByName(c, name, out))
  if (Array.isArray(tree)) (tree as unknown[]).forEach(c => collectNodesByName(c, name, out))
  return out
}

describe('structured tables (=row/=cell)', () => {
  it('parses basic structured table', () => {
    const src = `=begin table

=begin row
=cell Fruits
=cell Bananas
=cell Yellow and ripe
=end row

=end table
`
    const ast = parse(src, { podMode: 1 })
    const table = findNodeByName(ast, 'table') as { content?: unknown[] } | null
    expect(table).not.toBeNull()
    const rows = collectNodesByName(table, 'row')
    expect(rows).toHaveLength(1)
    const cells = collectNodesByName(rows[0], 'cell')
    expect(cells).toHaveLength(3)
  })

  it('parses row with :header attribute', () => {
    const src = `=begin table

=begin row :header
=cell Category
=cell Product
=end row

=begin row
=cell Fruits
=cell Bananas
=end row

=end table
`
    const ast = parse(src, { podMode: 1 })
    const rows = collectNodesByName(ast, 'row') as Array<{ config?: Array<{ name: string; value: unknown }> }>
    expect(rows).toHaveLength(2)
    const headerConfig = rows[0].config?.find(c => c.name === 'header')
    expect(headerConfig).toBeDefined()
    expect(headerConfig?.value).toBe(true)
  })

  it('text-mode table produces unified row/cell AST', () => {
    const src = `=begin table
  Name  | Age
  Alice | 30
  Bob   | 25
=end table
`
    const ast = parse(src, { podMode: 1 })
    const table = findNodeByName(ast, 'table') as { content?: unknown[] } | null
    expect(table).not.toBeNull()
    const rows = collectNodesByName(table, 'row')
    expect(rows).toHaveLength(3)
    const cells = collectNodesByName(table, 'cell')
    expect(cells.length).toBeGreaterThanOrEqual(6)
  })

  it('parses abbreviated =cell form', () => {
    const src = `=begin table

=begin row
=cell Apple
=cell Red
=end row

=end table
`
    const ast = parse(src, { podMode: 1 })
    const cells = collectNodesByName(ast, 'cell') as Array<{ content?: unknown[] }>
    expect(cells).toHaveLength(2)
  })

  it('renders structured table to HTML with <tr>/<td>', () => {
    const src = `=begin table

=begin row
=cell Fruits
=cell Bananas
=end row

=end table
`
    const html = toHtml({}).run(src).toString()
    expect(html).toContain('<table>')
    expect(html).toContain('<tr>')
    expect(html).toMatch(/<td>[\s\S]*Fruits[\s\S]*<\/td>/)
    expect(html).toMatch(/<td>[\s\S]*Bananas[\s\S]*<\/td>/)
  })

  it('renders :header row with <th> cells', () => {
    const src = `=begin table

=begin row :header
=cell Name
=cell Age
=end row

=begin row
=cell Alice
=cell 30
=end row

=end table
`
    const html = toHtml({}).run(src).toString()
    expect(html).toMatch(/<th>[\s\S]*Name[\s\S]*<\/th>/)
    expect(html).toMatch(/<th>[\s\S]*Age[\s\S]*<\/th>/)
    expect(html).toMatch(/<td>[\s\S]*Alice[\s\S]*<\/td>/)
    expect(html).toMatch(/<td>[\s\S]*30[\s\S]*<\/td>/)
  })

  it('renders :colspan and :rowspan as HTML attributes', () => {
    const src = `=begin table

=begin row :header
=for cell :colspan(2)
Item and Quantity
=cell Description
=end row

=begin row
=cell Apples
=cell 5
=for cell :rowspan(2)
Fruit for snacking
=end row

=begin row
=cell Bananas
=cell 3
=end row

=end table
`
    const html = toHtml({}).run(src).toString()
    expect(html).toMatch(/<th colspan="2">/)
    expect(html).toMatch(/<td rowspan="2">/)
  })

  it('colspan=1 and rowspan=1 do not emit attributes', () => {
    const src = `=begin table

=begin row
=for cell :colspan(1)
Alpha
=for cell :rowspan(1)
Beta
=end row

=end table
`
    const html = toHtml({}).run(src).toString()
    expect(html).not.toMatch(/colspan=/)
    expect(html).not.toMatch(/rowspan=/)
  })

  it('implicit cell wrapping for non-cell children in row', () => {
    const src = `=begin table

=begin row
=para Direct paragraph
=cell Explicit cell
=end row

=end table
`
    // implicit wrap happens via plugin-tables transform (skipChain=0 = skip plugins)
    const processed = toTree().parse(src, { podMode: 1 })
    const cells = collectNodesByName(processed, 'cell')
    expect(cells.length).toBe(2)
  })
})
