import { parse, toMarkdown } from '../src'

const table = (row: string): string =>
  ['=begin table', ' Expr | Note', ' =====|=====', ` ${row}`, '=end table', ''].join('\n')

// The bare parse leaves a cell's own text as plain strings; the plugin chain
// turns them into text nodes. Both shapes reach the markdown writer, and both
// must print the same cell.
const findTable = (node: any): any => {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findTable(child)
      if (found) return found
    }
    return null
  }
  if (node.name === 'table') return node
  for (const child of node.content || []) {
    const found = findTable(child)
    if (found) return found
  }
  return null
}

const asMarkdown = (source: string): string => {
  const block = findTable(parse(source, { podMode: 1 }))
  const root = { type: 'block', name: 'pod', margin: '', content: [block] }
  return String(toMarkdown({}).run(root).toString())
}

describe('a table cell keeps its own spacing', () => {
  it('keeps the spaces around a sign the parser split the text on', () => {
    expect(asMarkdown(table('text()($foo > $bar) | note'))).toContain('text()($foo > $bar)')
  })

  it('keeps the space between a markup code and the next word', () => {
    expect(asMarkdown(table('left | C<=code> and word'))).toContain('`=code` and word')
  })

  it('keeps the space before a markup code', () => {
    expect(asMarkdown(table('left | word and C<=code>'))).toContain('word and `=code`')
  })

  it('strips the padding at the edges of the cell', () => {
    const md = asMarkdown(table('  padded   | note'))
    expect(md).toContain('| padded |')
  })

  it('holds several codes in one cell apart', () => {
    expect(asMarkdown(table('left | C<a> or C<b>'))).toContain('`a` or `b`')
  })
})
