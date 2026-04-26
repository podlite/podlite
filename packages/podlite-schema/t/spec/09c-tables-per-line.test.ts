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

const cellText = (cell: unknown) => {
  const c = cell as { content?: unknown[] }
  const first = c.content?.[0] as string | { value: string } | undefined
  if (first === undefined) return ''
  return typeof first === 'string' ? first.trim() : (first.value ?? '').trim()
}

describe('per-line separator detection (Rule 1)', () => {
  let warnSpy: jest.SpyInstance
  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('Scenario 2: header pipes + data whitespace → all rows resolve to 3 cells', () => {
    const src = `=begin table
Name | Age | City
Alice  30    London
Bob    25    Paris
=end table
`
    const tree = toTree().parse(src, { podMode: 1, skipChain: 0 })
    const rows = collectNodesByName(findNodeByName(tree, 'table'), 'row')
    expect(rows).toHaveLength(3)
    rows.forEach(r => expect(collectNodesByName(r, 'cell')).toHaveLength(3))

    const headerCells = collectNodesByName(rows[0], 'cell')
    expect(headerCells.map(cellText)).toEqual(['Name', 'Age', 'City'])
    const aliceCells = collectNodesByName(rows[1], 'cell')
    expect(aliceCells.map(cellText)).toEqual(['Alice', '30', 'London'])
    const bobCells = collectNodesByName(rows[2], 'cell')
    expect(bobCells.map(cellText)).toEqual(['Bob', '25', 'Paris'])
  })

  it('Scenario 2 warning fires (Rule 3 retained)', () => {
    const src = `=begin table
Name | Age | City
Alice  30    London
=end table
`
    toTree().parse(src, { podMode: 1, skipChain: 0 })
    const calls = warnSpy.mock.calls.map(args => args[0])
    expect(calls.some(m => /mixed separator types/.test(m))).toBe(true)
  })

  it('uniform pipe table works as before (no whitespace artifacts since per-line)', () => {
    const src = `=begin table
Name | Age | City
Alice | 30 | London
Bob | 25 | Paris
=end table
`
    const tree = toTree().parse(src, { podMode: 1, skipChain: 0 })
    const rows = collectNodesByName(findNodeByName(tree, 'table'), 'row')
    expect(rows).toHaveLength(3)
    rows.forEach(r => expect(collectNodesByName(r, 'cell')).toHaveLength(3))
  })

  it('uniform whitespace table works as before', () => {
    const src = `=begin table
Name    Age    City
Alice   30     London
Bob     25     Paris
=end table
`
    const tree = toTree().parse(src, { podMode: 1, skipChain: 0 })
    const rows = collectNodesByName(findNodeByName(tree, 'table'), 'row')
    expect(rows).toHaveLength(3)
    rows.forEach(r => expect(collectNodesByName(r, 'cell')).toHaveLength(3))
  })

  it('plus separator alone — uniform → legacy positional path', () => {
    const src = `=begin table
Name + Age + City
Alice + 30 + London
=end table
`
    const tree = toTree().parse(src, { podMode: 1, skipChain: 0 })
    const rows = collectNodesByName(findNodeByName(tree, 'table'), 'row')
    expect(rows).toHaveLength(2)
    rows.forEach(r => expect(collectNodesByName(r, 'cell')).toHaveLength(3))
  })

  it('Scenario 2 with plus + whitespace mix → per-line splitting', () => {
    const src = `=begin table
Name + Age + City
Alice  30    London
=end table
`
    const tree = toTree().parse(src, { podMode: 1, skipChain: 0 })
    const rows = collectNodesByName(findNodeByName(tree, 'table'), 'row')
    expect(rows).toHaveLength(2)
    rows.forEach(r => expect(collectNodesByName(r, 'cell')).toHaveLength(3))
    const aliceCells = collectNodesByName(rows[1], 'cell')
    expect(aliceCells.map(cellText)).toEqual(['Alice', '30', 'London'])
  })
})
