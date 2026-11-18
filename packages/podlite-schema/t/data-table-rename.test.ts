import { podlitePluggable } from '../src'

// :rename names columns of the source, by name or by place, whatever :columns shows

type Node = Record<string, unknown>
const isNode = (x: unknown): x is Node => typeof x === 'object' && x !== null && !Array.isArray(x)
const listOf = (x: unknown): unknown[] => (Array.isArray(x) ? x : [])
const find = (node: unknown, name: string): Node[] => {
  const out: Node[] = []
  const walk = (n: unknown) => {
    if (Array.isArray(n)) return n.forEach(walk)
    if (!isNode(n)) return
    if (n.name === name) out.push(n)
    listOf(n.content).forEach(walk)
  }
  walk(node)
  return out
}
const cellText = (cell: Node) =>
  listOf(cell.content)
    .map(c => (typeof c === 'string' ? c : isNode(c) && typeof c.value === 'string' ? c.value : ''))
    .join('')
const isHeader = (row: Node) => listOf(row.config).some(c => isNode(c) && c.name === 'header' && c.value === true)

const table = (header: string, attrs: string, body = 'a,b,c\nx,y,z\n') => {
  const tree = podlitePluggable().parse(
    `=begin data-table :mime-type('text/csv; header=${header}') ${attrs}\n${body}=end data-table\n`,
    {
      podMode: 1,
    },
  )
  const tables = find(tree, 'table')
  const rows = find(tables[0], 'row')
  return {
    tables: tables.map(t => listOf(t.content).length),
    header: rows.filter(isHeader).map(row => find(row, 'cell').map(cellText)),
    data: rows.filter(row => !isHeader(row)).map(row => find(row, 'cell').map(cellText)),
    reports: (tree.diagnostics || []).map(d => d.code),
  }
}

describe(':rename with a header row', () => {
  it.each([
    [":columns(3,1) :rename{1=>'A name'}", ['c', 'A name'], [['z', 'x']]],
    [":columns(3,1) :rename{a=>'A name'}", ['c', 'A name'], [['z', 'x']]],
    [":rename{3=>'C'}", ['a', 'b', 'C'], [['x', 'y', 'z']]],
    [":columns(1,1) :rename{1=>'X'}", ['X', 'X'], [['x', 'x']]],
    [":rename{a=>'b',b=>'B'}", ['b', 'B', 'c'], [['x', 'y', 'z']]],
    [":rename{1=>'X',a=>'X'}", ['X', 'b', 'c'], [['x', 'y', 'z']]],
  ])('%s', (attrs, header, data) => {
    expect(table('present', attrs)).toEqual({ tables: [1 + data.length], header: [header], data, reports: [] })
  })
})

describe(':rename without a header row', () => {
  it('labels the other columns by their place in the source and keeps every row as data', () => {
    expect(table('absent', ":rename{2=>'Mid'}")).toEqual({
      tables: [3],
      header: [['1', 'Mid', '3']],
      data: [
        ['a', 'b', 'c'],
        ['x', 'y', 'z'],
      ],
      reports: [],
    })
    expect(table('absent', ":columns(3,1) :rename{1=>'First'}")).toEqual({
      tables: [3],
      header: [['3', 'First']],
      data: [
        ['c', 'a'],
        ['z', 'x'],
      ],
      reports: [],
    })
  })

  it('counts the columns of the widest row', () => {
    expect(table('absent', ":rename{3=>'Z'}", 'a,b\nx,y,z\n')).toMatchObject({
      header: [['1', '2', 'Z']],
      data: [
        ['a', 'b', ''],
        ['x', 'y', 'z'],
      ],
    })
    expect(table('absent', ":columns(3,1) :rename{3=>'Z'}", 'a,b\nx,y,z\n')).toEqual({
      tables: [3],
      header: [['Z', '1']],
      data: [
        ['', 'a'],
        ['z', 'x'],
      ],
      reports: ['table-row-cells'],
    })
  })

  it('labels the columns by place for an empty :rename too', () => {
    expect(table('absent', ':columns(3,1) :rename{}').header).toEqual([['3', '1']])
  })

  it('reads a long source without a header', () => {
    const long = table('absent', ":columns(1) :rename{1=>'X'}", 'v\n'.repeat(140000))
    expect([long.header, long.data.length, long.reports]).toEqual([[['X']], 140000, []])
  })

  it('leaves a table without :rename headerless', () => {
    expect(table('absent', ':columns(2)').header).toEqual([])
  })
})

describe('a :rename key the source or :columns does not have', () => {
  it.each([
    ['present', ":columns(2,3) :rename{1=>'X'}"],
    ['present', ":columns(1) :rename{b=>'B'}"],
    ['present', ":rename{9=>'X'}"],
    ['present', ":rename{nope=>'X'}"],
    ['present', ":rename{a=>'X',X=>'Y'}"],
    ['present', ":rename{1=>'a',a=>'Y'}"],
    ['absent', ":rename{a=>'A'}"],
  ])('header=%s %s is an error and an empty table', (header, attrs) => {
    expect(table(header, attrs)).toEqual({ tables: [0], header: [], data: [], reports: ['table-source-unreadable'] })
  })

  it.each(['present', 'absent'])('names nothing in an empty source, header=%s', header => {
    expect(table(header, ":rename{1=>'X'}", '')).toEqual({
      tables: [0],
      header: [],
      data: [],
      reports: ['table-source-unreadable'],
    })
  })
})
