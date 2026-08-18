import { toTree } from '../..'
import type { ParseDiagnostic } from '../../src/types'

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

const cellsOf = (row: unknown) =>
  collectNodesByName(row, 'cell').filter(c => (c as { content?: unknown[] }).content !== undefined) as Array<{
    content: unknown[]
  }>

describe('table error recovery (design notes Rules 2-4)', () => {
  let reports: ParseDiagnostic[]

  beforeEach(() => {
    reports = []
  })

  const parse = (src: string) => toTree().parse(src, { podMode: 1, skipChain: 0, diagnostics: reports })
  const said = (re: RegExp) => reports.some(d => re.test(d.message))

  // ─── Rule 2: cell count validation ──────────────────────────────────────

  it('Rule 2: pads short structured rows with empty cells', () => {
    const src = `=begin table

=begin row
=cell A
=cell B
=cell C
=end row

=begin row
=cell 1
=cell 2
=end row

=end table
`
    const tree = parse(src)
    const rows = collectNodesByName(findNodeByName(tree, 'table'), 'row')
    expect(rows).toHaveLength(2)
    expect(cellsOf(rows[0])).toHaveLength(3)
    expect(cellsOf(rows[1])).toHaveLength(3)
    expect(said(/row has 2 of 3 cells, padded/)).toBe(true)
  })

  it('Rule 2: truncates long structured rows', () => {
    const src = `=begin table

=begin row :header
=cell A
=cell B
=end row

=begin row
=cell 1
=cell 2
=cell 3
=cell 4
=end row

=end table
`
    const tree = parse(src)
    const rows = collectNodesByName(findNodeByName(tree, 'table'), 'row')
    expect(rows).toHaveLength(2)
    expect(cellsOf(rows[0])).toHaveLength(2)
    expect(cellsOf(rows[1])).toHaveLength(2)
    expect(said(/row has 4 of 2 cells, dropped 2/)).toBe(true)
  })

  it('Rule 2: header row determines expected count over data row maximum', () => {
    const src = `=begin table

=begin row :header
=cell H1
=cell H2
=end row

=begin row
=cell A
=cell B
=cell C
=end row

=begin row
=cell X
=cell Y
=cell Z
=end row

=end table
`
    const tree = parse(src)
    const rows = collectNodesByName(findNodeByName(tree, 'table'), 'row')
    rows.forEach(r => expect(cellsOf(r)).toHaveLength(2))
  })

  it('Rule 2: balanced table emits no warnings', () => {
    const src = `=begin table

=begin row
=cell A
=cell B
=end row

=begin row
=cell 1
=cell 2
=end row

=end table
`
    parse(src)
    expect(reports).toEqual([])
  })

  // ─── Rule 3: mixed separator warning ────────────────────────────────────

  it('Rule 3: warns when text-mode mixes pipe and whitespace separators', () => {
    const src = `=begin table
Name | Age | City
Alice  30   London
Bob    25   Paris
=end table
`
    parse(src)
    expect(said(/mixes separator styles/)).toBe(true)
  })

  it('Rule 3: uniform pipe separator emits no mixed warning', () => {
    const src = `=begin table
Name | Age | City
Alice | 30 | London
Bob | 25 | Paris
=end table
`
    parse(src)
    expect(said(/mixes separator styles/)).toBe(false)
  })

  // ─── Rule 4: CSV error recovery ─────────────────────────────────────────

  it('Rule 4: missing =data block leaves =table empty', () => {
    const src = `=for table
data:nonexistent
`
    const tree = parse(src)
    const table = findNodeByName(tree, 'table') as { content: unknown[] }
    expect(table).toBeTruthy()
    expect(Array.isArray(table.content)).toBe(true)
    expect(table.content).toHaveLength(0)
    expect(said(/no =data block found.*rendered as empty/)).toBe(true)
  })

  it('Rule 4: non-CSV mime-type renders as =code block instead of =table', () => {
    const src = `=for table
data:rawjson

=begin data :key<rawjson> :mime-type<application/json>
{"a": 1}
=end data
`
    const tree = parse(src)
    expect(findNodeByName(tree, 'table')).toBeNull()
    const code = findNodeByName(tree, 'code') as { content: unknown[] }
    expect(code).toBeTruthy()
    expect(said(/non-tabular mime-type.*rendered as =code/)).toBe(true)
  })

  it('Rule 4: well-formed CSV produces table without warnings', () => {
    const src = `=for table :header
data:recipe

=begin data :key<recipe> :mime-type<text/csv>
ingredient,quantity
flour,2
=end data
`
    parse(src)
    expect(reports).toEqual([])
  })
})
