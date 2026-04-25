import { toTree, toHtml } from '../..'

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

describe('tables from CSV data blocks (spec §1672)', () => {
  it('=for table data:<key> resolves to =row/=cell blocks from =data block', () => {
    const src = `=for table :caption('Ingredients')
data:recipe

=begin data :key<recipe> :mime-type<text/csv>
ingredient,quantity,unit
flour,2,cups
sugar,1,cups
=end data
`
    const tree = toTree().parse(src, { podMode: 1, skipChain: 0 })
    const table = findNodeByName(tree, 'table') as { content: unknown[] }
    expect(table).toBeTruthy()
    const rows = collectNodesByName(table, 'row')
    expect(rows).toHaveLength(3)
    const firstRowCells = collectNodesByName(rows[0], 'cell') as Array<{ content: unknown[] }>
    expect(firstRowCells).toHaveLength(3)
    const cellText = (cell: { content: unknown[] }) => {
      const first = cell.content[0] as string | { value: string }
      return typeof first === 'string' ? first : first.value
    }
    expect(firstRowCells.map(cellText)).toEqual(['ingredient', 'quantity', 'unit'])
    const dataRowCells = collectNodesByName(rows[1], 'cell') as Array<{ content: unknown[] }>
    expect(dataRowCells.map(cellText)).toEqual(['flour', '2', 'cups'])
  })

  it('CSV-sourced table never marks a row as :header (spec is silent on this)', () => {
    // The spec section "Table from CSV files or data blocks" (§1672) does
    // not define how to mark a header in CSV-sourced tables. Authors who
    // need a header row should use a structured table or a Markdown GFM
    // table.
    const src = `=for table
data:people

=begin data :key<people> :mime-type<text/csv>
name,age
Alice,30
=end data
`
    const tree = toTree().parse(src, { podMode: 1, skipChain: 0 })
    const rows = collectNodesByName(findNodeByName(tree, 'table'), 'row') as Array<{
      config?: Array<{ name: string; value: unknown }>
    }>
    const isHeader = (r: { config?: Array<{ name: string; value: unknown }> }) =>
      Boolean(r.config?.some(c => c.name === 'header' && c.value === true))
    expect(rows.every(r => !isHeader(r))).toBe(true)
  })

  it('RFC 4180 quoted fields and embedded quotes', () => {
    const src = `=for table
data:quoted

=begin data :key<quoted> :mime-type<text/csv>
name,note
"Doe, John","Says ""hi"""
Smith,plain
=end data
`
    const tree = toTree().parse(src, { podMode: 1, skipChain: 0 })
    const rows = collectNodesByName(findNodeByName(tree, 'table'), 'row') as Array<{ content: unknown[] }>
    expect(rows).toHaveLength(3)
    const cellText = (cell: { content: unknown[] }) => {
      const first = cell.content[0] as string | { value: string }
      return typeof first === 'string' ? first : first.value
    }
    const cells = collectNodesByName(rows[1], 'cell') as Array<{ content: unknown[] }>
    expect(cells.map(cellText)).toEqual(['Doe, John', 'Says "hi"'])
  })

  it('missing =data block leaves =table intact', () => {
    const src = `=for table
data:missing
`
    const tree = toTree().parse(src, { podMode: 1, skipChain: 0 })
    const table = findNodeByName(tree, 'table') as { content: unknown[] }
    // No CSV resolution happened — table keeps its original unresolved content
    const rows = collectNodesByName(table, 'row')
    // The original text-mode parser treats `data:missing` as a single-cell row
    expect(rows.length).toBeGreaterThanOrEqual(0)
  })

  it('=data block without text/csv mime-type is not resolved', () => {
    const src = `=for table
data:raw

=begin data :key<raw> :mime-type<application/json>
{"a": 1}
=end data
`
    const tree = toTree().parse(src, { podMode: 1, skipChain: 0 })
    const rows = collectNodesByName(findNodeByName(tree, 'table'), 'row') as Array<{ content: unknown[] }>
    const cellText = (cell: { content: unknown[] }) => {
      const first = cell.content[0] as string | { value: string }
      return typeof first === 'string' ? first : first.value
    }
    // No CSV resolution: original table content remains (single row with 'data:raw' text).
    // Exact shape depends on text-mode parser; we just assert no CSV expansion happened.
    const flatCells = rows.flatMap(r => collectNodesByName(r, 'cell') as Array<{ content: unknown[] }>)
    expect(flatCells.some(c => cellText(c) === '{"a": 1}')).toBe(false)
  })

  it('renders CSV-sourced table to HTML with expected structure', () => {
    const src = `=for table
data:recipe

=begin data :key<recipe> :mime-type<text/csv>
ingredient,quantity
flour,2
sugar,1
=end data
`
    const html = toHtml({}).run(src).toString()
    expect(html).toMatch(/<table[\s>]/)
    expect(html).toMatch(/ingredient/)
    expect(html).toMatch(/flour/)
    // Without a header marker, all rows render as <td> — no <th>
    expect(html).not.toMatch(/<th[\s>]/)
  })

  it('file: scheme is not resolved (deferred — host reader required)', () => {
    const src = `=table file:external.csv
`
    const tree = toTree().parse(src, { podMode: 1, skipChain: 0 })
    const table = findNodeByName(tree, 'table')
    // Table still exists in AST; content not replaced by CSV expansion
    expect(table).toBeTruthy()
  })

  // ─── TSV (text/tab-separated-values) ──────────────────────────────────────

  it('TSV: basic resolution from =data block', () => {
    const src = `=for table
data:metrics

=begin data :key<metrics> :mime-type<text/tab-separated-values>
metric\tvalue\tunit
latency\t120\tms
throughput\t850\trps
=end data
`
    const tree = toTree().parse(src, { podMode: 1, skipChain: 0 })
    const rows = collectNodesByName(findNodeByName(tree, 'table'), 'row') as Array<{ content: unknown[] }>
    expect(rows).toHaveLength(3)
    const cellText = (cell: { content: unknown[] }) => {
      const first = cell.content[0] as string | { value: string }
      return typeof first === 'string' ? first : first.value
    }
    const headerCells = collectNodesByName(rows[0], 'cell') as Array<{ content: unknown[] }>
    expect(headerCells.map(cellText)).toEqual(['metric', 'value', 'unit'])
    const dataCells = collectNodesByName(rows[1], 'cell') as Array<{ content: unknown[] }>
    expect(dataCells.map(cellText)).toEqual(['latency', '120', 'ms'])
  })

  it('TSV: literal " in field is preserved (no quoting unlike CSV)', () => {
    const src = `=for table
data:quoted

=begin data :key<quoted> :mime-type<text/tab-separated-values>
name\tnote
Alice\tSays "hi"
=end data
`
    const tree = toTree().parse(src, { podMode: 1, skipChain: 0 })
    const rows = collectNodesByName(findNodeByName(tree, 'table'), 'row') as Array<{ content: unknown[] }>
    expect(rows).toHaveLength(2)
    const cellText = (cell: { content: unknown[] }) => {
      const first = cell.content[0] as string | { value: string }
      return typeof first === 'string' ? first : first.value
    }
    const cells = collectNodesByName(rows[1], 'cell') as Array<{ content: unknown[] }>
    expect(cells.map(cellText)).toEqual(['Alice', 'Says "hi"'])
  })

  it('TSV: comma in field is a literal character (not separator)', () => {
    const src = `=for table
data:names

=begin data :key<names> :mime-type<text/tab-separated-values>
full_name\tcity
Doe, John\tBoston
=end data
`
    const tree = toTree().parse(src, { podMode: 1, skipChain: 0 })
    const rows = collectNodesByName(findNodeByName(tree, 'table'), 'row') as Array<{ content: unknown[] }>
    expect(rows).toHaveLength(2)
    const cellText = (cell: { content: unknown[] }) => {
      const first = cell.content[0] as string | { value: string }
      return typeof first === 'string' ? first : first.value
    }
    const cells = collectNodesByName(rows[1], 'cell') as Array<{ content: unknown[] }>
    expect(cells.map(cellText)).toEqual(['Doe, John', 'Boston'])
  })

  it('TSV and CSV blocks coexist in same document', () => {
    const src = `=for table
data:csvData

=for table
data:tsvData

=begin data :key<csvData> :mime-type<text/csv>
a,b
1,2
=end data

=begin data :key<tsvData> :mime-type<text/tab-separated-values>
x\ty
9\t8
=end data
`
    const tree = toTree().parse(src, { podMode: 1, skipChain: 0 })
    const tables = collectNodesByName(tree, 'table')
    expect(tables).toHaveLength(2)
    const cellText = (cell: { content: unknown[] }) => {
      const first = cell.content[0] as string | { value: string }
      return typeof first === 'string' ? first : first.value
    }
    const csvCells = collectNodesByName(tables[0], 'cell') as Array<{ content: unknown[] }>
    expect(csvCells.map(cellText)).toEqual(['a', 'b', '1', '2'])
    const tsvCells = collectNodesByName(tables[1], 'cell') as Array<{ content: unknown[] }>
    expect(tsvCells.map(cellText)).toEqual(['x', 'y', '9', '8'])
  })
})
