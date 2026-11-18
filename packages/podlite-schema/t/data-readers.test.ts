import { podlitePluggable } from '../src'
import { runSelector, SelectorError } from '../src/selectors'

// every reader of a =data block reads the same thing: a table, a data table and a selector

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
const rowsOf = (table: Node | undefined) => find(table, 'row').map(row => find(row, 'cell').map(cellText))

const parse = (src: string) => podlitePluggable().parse(src, { podMode: 1 })
const readers = (src: string) => {
  const tree = parse(`${src}\n=table data:d\n\n=for data-table :src<data:d>\n`)
  return find(tree, 'table').map(rowsOf)
}
const select = (src: string, selector: string) => {
  try {
    const found = runSelector(selector, [{ file: 'x.podlite', node: parse(src) }])
    return found.length
  } catch (e) {
    return e instanceof SelectorError ? e.kind : 'other'
  }
}

describe('a type given to the data block by =config', () => {
  const tsv = "=config data :mime-type('text/tab-separated-values; header=present')\n\n"
  const block = '=begin data :key<d>\nh\tj\nv\tw\n=end data\n'

  it('is read by a table as by a data table', () => {
    expect(readers(`${tsv}${block}`)).toEqual([
      [
        ['h', 'j'],
        ['v', 'w'],
      ],
      [
        ['h', 'j'],
        ['v', 'w'],
      ],
    ])
  })

  it('is read by a selector by the same column', () => {
    expect(select(`${tsv}${block}\n=for Item :v<w>\nX.\n`, '| Item[ :v(in data:d#j) ]')).toBe(1)
  })

  it('yields to a type written on the data block', () => {
    const own = "=begin data :key<d> :mime-type('text/csv; header=present')\nh,j\nv,w\n=end data\n"
    expect(readers(`${tsv}${own}`)[0]).toEqual([
      ['h', 'j'],
      ['v', 'w'],
    ])
  })

  it('reaches only the data blocks after it', () => {
    const tree = parse(`${block}\n${tsv}=table data:d\n`)
    expect(find(tree, 'table')).toEqual([])
    expect(find(tree, 'code')).toHaveLength(1)
  })

  it('reports a header the norm does not know once, at the data block', () => {
    const maybe = "=config data :mime-type('text/csv; header=maybe')\n\n=begin data :key<d>\nh\nv\n=end data\n"
    const tree = parse(`${maybe}\n=table data:d\n\n=for data-table :src<data:d>\n`)
    expect((tree.diagnostics || []).map(d => [d.code, d.location.start.line])).toEqual([['table-header-invalid', 3]])
  })
})

describe('a data block with :allow', () => {
  it.each([
    ['CSV', 'text/csv', 'h\nv\n'],
    ['TSV', 'text/tab-separated-values', 'h\nv\n'],
  ])('%s is read by a selector as written', (_, type, body) => {
    const src = `=begin data :key<d> :allow<B> :mime-type('${type}; header=present')\n${body}=end data\n\n=for Item :v<v>\nX.\n`
    expect([select(src, '| Item[ :v(in data:d) ]'), select(src, '| Item[ :v(in data:d#h) ]')]).toEqual([1, 1])
  })

  it('that is not CSV is a format error for a selector', () => {
    const src =
      "=begin data :key<d> :allow<B> :mime-type('text/csv; header=present')\nh\na\"b\n=end data\n\n=for Item :v<a>\nX.\n"
    expect([select(src, '| Item[ :v(in data:d) ]'), select(src, '| Item[ :v(in data:d#h) ]')]).toEqual([
      'format',
      'format',
    ])
  })

  it('gives a selector and a table the same value, markup and all', () => {
    const src = "=begin data :key<d> :allow<B> :mime-type('text/csv; header=present')\nh\nB<v>\n=end data\n"
    expect(readers(src)[0]).toEqual([['h'], ['B<v>']])
    expect(select(`${src}\n=for Item :v('B<v>')\nX.\n`, '| Item[ :v(in data:d#h) ]')).toBe(1)
  })

  it('keeps the codes it allows in its own tree, and its body as written beside them', () => {
    const data = find(parse('=begin data :key<d> :allow<B> :mime-type<text/csv>\nh\nB<v>\n=end data\n'), 'data')[0]
    expect(listOf(data.content).some(c => isNode(c) && c.type === 'fcode' && c.name === 'B')).toBe(true)
    expect(data.dataText).toBe('h\nB<v>\n')
    expect(String(data.text)).toMatch(/^=begin data/)
  })
})
