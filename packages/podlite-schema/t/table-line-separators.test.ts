import { podlitePluggable } from '../src/pluggableParser'
import type { ParseDiagnostic } from '../src'

// the parser of this package, so a run against its earlier source reads that source
const p = podlitePluggable()

type Node = { type?: string; name?: string; value?: unknown; content?: unknown }

const isNode = (value: unknown): value is Node => typeof value === 'object' && value !== null && !Array.isArray(value)

const textOf = (node: unknown): string => {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (!isNode(node)) return ''
  if (node.type === 'fcode') return `${node.name}<${textOf(node.content)}>`
  if (node.value !== undefined) return String(node.value)
  return textOf(node.content)
}

const tablesOf = (node: unknown, out: Node[] = []): Node[] => {
  if (Array.isArray(node)) node.forEach(child => tablesOf(child, out))
  else if (isNode(node)) {
    if (node.type === 'block' && node.name === 'table') out.push(node)
    tablesOf(node.content, out)
  }
  return out
}

// the rows of one table, without descending into a table nested in a cell
const rowsOf = (table: Node): string[][] => {
  const rows: string[][] = []
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!isNode(node)) return
    if (node.type === 'block' && node.name === 'table' && node !== table) return
    if (node.type === 'block' && node.name === 'row') {
      const cells = (Array.isArray(node.content) ? node.content : []).filter(
        (c): c is Node => isNode(c) && c.name === 'cell',
      )
      rows.push(cells.map(cell => textOf(cell.content).trim()))
      return
    }
    walk(node.content)
  }
  walk(table.content)
  return rows
}

const parsed = (doc: string) => {
  const diagnostics: ParseDiagnostic[] = []
  const tree: unknown = p.toAst(p.parse(doc, { podMode: 1, diagnostics }))
  return { tables: tablesOf(tree).map(rowsOf), codes: diagnostics.map(d => d.code) }
}

const rows = (doc: string) => parsed(doc).tables[0]

describe('a table with bars, every row on one line, splits each line by its own separators', () => {
  it('keeps the spaces inside a cell of a barred line', () => {
    expect(rows('=table\na   b | c\n')).toEqual([['a   b', 'c']])
  })

  it('keeps an empty cell between two bars', () => {
    expect(rows('=table\na |   | z\n')).toEqual([['a', '', 'z']])
    expect(rows('=table\na |   |   | z\n')).toEqual([['a', '', '', 'z']])
    expect(rows('=table\na | | z\n')).toEqual([['a', '', 'z']])
  })

  it('keeps an empty cell between two pluses', () => {
    expect(rows('=table\na +   + z\n')).toEqual([['a', '', 'z']])
    expect(rows('=table\na + + z\n')).toEqual([['a', '', 'z']])
  })

  it('keeps the empty cell an edge bar stands for', () => {
    expect(rows('=table\n    X | O |\n')).toEqual([['X', 'O', '']])
    expect(rows('=table\n      | X | O\n')).toEqual([['', 'X', 'O']])
  })

  it('splits a line drawn with bars on both edges', () => {
    expect(rows('=begin table\n| a | b |\n| c | d |\n=end table\n')).toEqual([
      ['', 'a', 'b', ''],
      ['', 'c', 'd', ''],
    ])
  })

  it('splits every row by its own bars', () => {
    expect(rows('=begin table\na   b | c\nx   y | z\n=end table\n')).toEqual([
      ['a   b', 'c'],
      ['x   y', 'z'],
    ])
    expect(rows('=begin table\na | b\nlonger | z\n=end table\n')).toEqual([
      ['a', 'b'],
      ['longer', 'z'],
    ])
  })

  it('splits a header and a row under a separator by their own bars', () => {
    const { tables, codes } = parsed('=begin table\nA     | B\n=========\na   b | c\n=end table\n')
    expect(tables[0]).toEqual([
      ['A', 'B'],
      ['a   b', 'c'],
    ])
    expect(codes).not.toContain('table-row-cells')
  })

  it('keeps a plus written in the text of a barred line', () => {
    expect(rows('=table\naxona | Desktop + Wiki | active\n')).toEqual([['axona', 'Desktop + Wiki', 'active']])
  })

  it('splits a table nested in a cell the same way', () => {
    const { tables } = parsed(
      '=begin table\n=begin row\n=begin cell\n=table\na   b | c\n\n=end cell\n=end row\n=end table\n',
    )
    expect(tables[1]).toEqual([['a   b', 'c']])
  })
})

describe('tables the line by line split leaves as they were', () => {
  it('keeps rows that already split by their bars', () => {
    expect(rows('=begin table\na |   | z\nb | y | q\n=end table\n')).toEqual([
      ['a', '', 'z'],
      ['b', 'y', 'q'],
    ])
    expect(rows('=table\na | b | c\n')).toEqual([['a', 'b', 'c']])
    expect(rows('=table\na + b + c\n')).toEqual([['a', 'b', 'c']])
  })

  it('reads a bar or a plus without spaces around it as text', () => {
    expect(rows('=table\na|b | z\n')).toEqual([['a|b', 'z']])
    expect(rows('=table\na+b + z\n')).toEqual([['a+b', 'z']])
    expect(rows('=table\nC++ | z\n')).toEqual([['C++', 'z']])
  })

  it('keeps a bar inside a code closed on the line', () => {
    expect(rows('=table\nC<x | y> | z\n')).toEqual([['C<x | y>', 'z']])
    expect(rows('=table\nC<x | y> + z\n')).toEqual([['C<x | y>', 'z']])
  })

  it('keeps the shared column positions for a row on several lines', () => {
    expect(rows('=begin table\nA     | B\n=========\na   b | c\nx   y | z\n\np     | q\n=end table\n')).toEqual([
      ['A', '', 'B'],
      ['a x', 'b y', 'c z'],
      ['p', '', 'q'],
    ])
  })

  it('keeps a mixed table split as before', () => {
    const { tables, codes } = parsed('=begin table\n| a | b |\nx    y\n=end table\n')
    expect(tables[0]).toEqual([
      ['a', 'b'],
      ['x', 'y'],
    ])
    expect(codes).toContain('table-mixed-separators')
  })

  it('keeps a header written on two lines', () => {
    const doc = [
      '=begin table',
      'Superhero     | Secret          |',
      '              | Identity        | Superpower',
      '==============|=================|================================',
      'The Shoveller | Eddie Stevens   | King Arthur singing shovel',
      '=end table',
      '',
    ].join('\n')
    expect(rows(doc)).toEqual([
      ['Superhero', 'Secret        Identity', 'Superpower'],
      ['The Shoveller', 'Eddie Stevens', 'King Arthur singing shovel'],
    ])
  })
})
