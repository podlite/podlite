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
