import { toTree } from '../..'

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
  let warnSpy: jest.SpyInstance

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

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
    const tree = toTree().parse(src, { podMode: 1, skipChain: 0 })
    const rows = collectNodesByName(findNodeByName(tree, 'table'), 'row')
    expect(rows).toHaveLength(2)
    expect(cellsOf(rows[0])).toHaveLength(3)
    expect(cellsOf(rows[1])).toHaveLength(3)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/row has 2 cells, expected 3 — padded/))
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
    const tree = toTree().parse(src, { podMode: 1, skipChain: 0 })
    const rows = collectNodesByName(findNodeByName(tree, 'table'), 'row')
    expect(rows).toHaveLength(2)
    expect(cellsOf(rows[0])).toHaveLength(2)
    expect(cellsOf(rows[1])).toHaveLength(2)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/row has 4 cells, expected 2 — truncated 2/))
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
    const tree = toTree().parse(src, { podMode: 1, skipChain: 0 })
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
    toTree().parse(src, { podMode: 1, skipChain: 0 })
    expect(warnSpy).not.toHaveBeenCalled()
  })

  // ─── Rule 3: mixed separator warning ────────────────────────────────────

  it('Rule 3: warns when text-mode mixes pipe and whitespace separators', () => {
    const src = `=begin table
Name | Age | City
Alice  30   London
Bob    25   Paris
=end table
`
    toTree().parse(src, { podMode: 1, skipChain: 0 })
    const calls = warnSpy.mock.calls.map(args => args[0])
    expect(calls.some(m => /mixed separator types/.test(m))).toBe(true)
  })

  it('Rule 3: uniform pipe separator emits no mixed warning', () => {
    const src = `=begin table
Name | Age | City
Alice | 30 | London
Bob | 25 | Paris
=end table
`
    toTree().parse(src, { podMode: 1, skipChain: 0 })
    const calls = warnSpy.mock.calls.map(args => args[0])
    expect(calls.some(m => /mixed separator types/.test(m))).toBe(false)
  })

  // ─── Rule 4: CSV error recovery ─────────────────────────────────────────

  it('Rule 4: missing =data block leaves =table empty', () => {
    const src = `=for table
data:nonexistent
`
    const tree = toTree().parse(src, { podMode: 1, skipChain: 0 })
    const table = findNodeByName(tree, 'table') as { content: unknown[] }
    expect(table).toBeTruthy()
    expect(Array.isArray(table.content)).toBe(true)
    expect(table.content).toHaveLength(0)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/no =data block found.*rendered as empty/))
  })

  it('Rule 4: non-CSV mime-type renders as =code block instead of =table', () => {
    const src = `=for table
data:rawjson

=begin data :key<rawjson> :mime-type<application/json>
{"a": 1}
=end data
`
    const tree = toTree().parse(src, { podMode: 1, skipChain: 0 })
    expect(findNodeByName(tree, 'table')).toBeNull()
    const code = findNodeByName(tree, 'code') as { content: unknown[] }
    expect(code).toBeTruthy()
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/non-tabular mime-type.*rendered as =code/))
  })

  it('Rule 4: well-formed CSV produces table without warnings', () => {
    const src = `=for table :header
data:recipe

=begin data :key<recipe> :mime-type<text/csv>
ingredient,quantity
flour,2
=end data
`
    toTree().parse(src, { podMode: 1, skipChain: 0 })
    expect(warnSpy).not.toHaveBeenCalled()
  })
})
