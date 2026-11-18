import { podlitePluggable, validateAstTree, validatePodliteAst } from '../src'
import * as tables from '../src/plugin-tables'

// a data table takes its rows from :src or from its body, never from both

const data = '=begin data :key<d> :mime-type<text/csv>\nh\nv\n=end data\n\n'
const parse = (src: string) => podlitePluggable().parse(src, { podMode: 1 })
type Node = Record<string, unknown>
const isNode = (x: unknown): x is Node => typeof x === 'object' && x !== null && !Array.isArray(x)
const tableOf = (src: string) => {
  const tree = parse(src)
  const items: unknown[] = Array.isArray(tree.content) ? tree.content : []
  const table = items.filter(isNode).find(n => n.name === 'table')
  const content = table && Array.isArray(table.content) ? table.content : undefined
  return {
    rows: content ? content.length : undefined,
    reports: (tree.diagnostics || []).map(d => [d.severity, d.code]),
  }
}

describe('a source next to a body', () => {
  it.each([
    ['a blank line', '=begin data-table :src<data:d>\n\n=end data-table\n'],
    ['a line of spaces', '=begin data-table :src<data:d>\n   \n=end data-table\n'],
    ['text', '=begin data-table :src<data:d>\nx\n=end data-table\n'],
    ['an empty :src', '=begin data-table :src<> :mime-type<text/csv>\nx\n=end data-table\n'],
    ['a source set for the block', '=set :src<data:d>\n=begin data-table\nx\n=end data-table\n'],
  ])('is an error and an empty table with %s', (_, table) => {
    const find = jest.spyOn(tables, 'findDataBlockByKey')
    expect(tableOf(`${data}${table}`)).toEqual({ rows: 0, reports: [['error', 'table-source-conflict']] })
    expect(find).not.toHaveBeenCalled()
    find.mockRestore()
  })

  it.each([
    ['=end right away', '=begin data-table :src<data:d>\n=end data-table\n'],
    ['a paragraph block', '=for data-table :src<data:d>\n'],
    ['a paragraph block and a blank line after it', '=for data-table :src<data:d>\n\ntext\n'],
  ])('is no conflict with %s', (_, table) => {
    expect(tableOf(`${data}${table}`)).toEqual({ rows: 2, reports: [] })
  })

  it('is valid by both schemas', () => {
    const doc = parse(`${data}=begin data-table :src<data:d>\n\n=end data-table\n`)
    expect((doc.diagnostics || []).map(d => d.code)).toEqual(['table-source-conflict'])
    expect(validatePodliteAst(doc)).toEqual([])
    expect(validateAstTree([doc])).toEqual([])
  })
})

describe('a source that is not tabular', () => {
  const plain = '=begin data :key<k> :mime-type<text/plain>\nB<X>\n=end data\n\n'
  const readers = {
    'table data:': `${plain}=for table :allow<B>\ndata:k\n`,
    'data-table :src': `${plain}=for data-table :src<data:k> :allow<B>\n`,
    'data-table body': '=begin data-table :mime-type<text/plain> :allow<B>\nB<X>\n=end data-table\n',
  }
  const blocks = (src: string, name: string) => {
    const items: unknown[] = Array.isArray(parse(src).content) ? parse(src).content : []
    return items.filter(isNode).filter(n => n.name === name)
  }

  it.each(Object.entries(readers))('is shown as code, literally and at its reader, by %s', (_, src) => {
    const code = blocks(src, 'code')
    expect(blocks(src, 'table')).toEqual([])
    expect(code.map(c => c.content)).toEqual([[{ type: 'verbatim', value: 'B<X>\n' }]])
    const raw = podlitePluggable().parse(src, { podMode: 1, skipChain: 1 })
    const rawItems: unknown[] = Array.isArray(raw.content) ? raw.content : []
    const reader = rawItems.filter(isNode).find(n => n.name === (src.includes('=for table') ? 'table' : 'data-table'))
    expect(code[0].location).toEqual(reader && reader.location)
    expect((parse(src).diagnostics || []).map(d => [d.severity, d.code])).toEqual([
      ['warning', 'table-source-unreadable'],
    ])
  })
})

describe('the widths of the source rows under :columns', () => {
  const src = (columns: string) =>
    `=begin data-table :mime-type('text/csv') ${columns}\nh,j\nx\ny,z,w\n=end data-table\n`
  const messages = (s: string) =>
    (parse(s).diagnostics || []).filter(d => d.code === 'table-row-cells').map(d => d.message)

  it('reports each uneven row once, with or without chosen columns', () => {
    expect(messages(src(''))).toEqual([
      'data-table row 2 has 1 of 2 cells, padded with 1 empty',
      'data-table row 3 has 3 of 2 cells, dropped 1',
    ])
    expect(messages(src(':columns(1)'))).toEqual([
      'data-table source row 2 has 1 of 2 cells',
      'data-table source row 3 has 3 of 2 cells',
    ])
    const cells = (s: string) => {
      const items: unknown[] = Array.isArray(parse(s).content) ? parse(s).content : []
      const table = items.filter(isNode).find(n => n.name === 'table')
      const rows: unknown[] = table && Array.isArray(table.content) ? table.content : []
      return rows
        .filter(isNode)
        .map(row =>
          (Array.isArray(row.content) ? row.content : []).filter(isNode).map(cell => JSON.stringify(cell.content)),
        )
    }
    const text = (s: string) => JSON.stringify([{ type: 'text', value: s }])
    expect(cells(src(':columns(1)'))).toEqual([[text('h')], [text('x')], [text('y')]])
  })

  it('says nothing about an even source', () => {
    expect(messages("=begin data-table :mime-type('text/csv') :columns(1)\nh,j\nx,y\n=end data-table\n")).toEqual([])
  })

  it('reports nothing more than the error of a column out of range', () => {
    expect((parse(src(':columns(4)')).diagnostics || []).map(d => d.code)).toEqual(['table-source-unreadable'])
  })

  it('reports nothing more than the error of a :rename key out of range', () => {
    expect((parse(src(":rename{9=>'H'}")).diagnostics || []).map(d => d.code)).toEqual(['table-source-unreadable'])
  })

  it('numbers the source rows without counting the labels :rename adds', () => {
    const absent =
      "=begin data-table :mime-type('text/csv; header=absent') :rename{1=>'H'}\nh,j\nx\ny,z,w\n=end data-table\n"
    expect(messages(absent)).toEqual([
      'data-table row 1 has 2 of 3 cells, padded with 1 empty',
      'data-table row 2 has 1 of 3 cells, padded with 2 empty',
    ])
  })

  it('reads a long source without a header and without :rename', () => {
    const long = `=begin data-table :mime-type('text/csv; header=absent') :columns(1)\n${'v\n'.repeat(
      140000,
    )}=end data-table\n`
    expect([tableOf(long).rows, tableOf(long).reports]).toEqual([140000, []])
  })
})
