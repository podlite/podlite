import { parse } from '../../src'

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

  it('falls back to text-mode for non-structured table', () => {
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
    expect(rows).toHaveLength(0)
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
})
