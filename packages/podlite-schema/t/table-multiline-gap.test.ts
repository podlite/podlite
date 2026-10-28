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

const rowsOf = (node: unknown, out: Node[] = []): Node[] => {
  if (Array.isArray(node)) node.forEach(child => rowsOf(child, out))
  else if (isNode(node)) {
    if (node.type === 'block' && node.name === 'row') out.push(node)
    else rowsOf(node.content, out)
  }
  return out
}

const table = (doc: string) => {
  const diagnostics: ParseDiagnostic[] = []
  const tree: unknown = p.toAst(p.parse(doc, { podMode: 1, diagnostics }))
  const rows = rowsOf(tree).map(row =>
    (Array.isArray(row.content) ? row.content : [])
      .filter((c): c is Node => isNode(c) && c.name === 'cell')
      .map(cell => textOf(cell.content).trim()),
  )
  return { rows, codes: diagnostics.map(d => d.code) }
}

const simple = (...lines: string[]) => `=begin table\n${lines.join('\n')}\n=end table\n`

describe('two spaces divide the columns of a row written on several lines', () => {
  it('splits a row whose next line has two spaces between its parts', () => {
    const { rows, codes } = table(
      simple(
        'Name    Age  City',
        '------  ---  ------',
        'Alice   30   London',
        '        old  town',
        '',
        'Bob     25   Paris',
      ),
    )
    expect(rows).toEqual([
      ['Name', 'Age', 'City'],
      ['Alice', '30  old', 'London town'],
      ['Bob', '25', 'Paris'],
    ])
    expect(codes).not.toContain('table-row-cells')
  })

  it('splits a header written on two lines', () => {
    const { rows, codes } = table(
      simple('Command  Meaning', 'git      version', '----------------', 'log      history'),
    )
    expect(rows).toEqual([
      ['Command git', 'Meaning version'],
      ['log', 'history'],
    ])
    expect(codes).not.toContain('table-row-cells')
  })

  it('splits a header that holds a code with a bar', () => {
    expect(table(simple('C<a | b>  desc', 'next      more', '----------', 'z         tail')).rows).toEqual([
      ['C<a | b> next', 'desc more'],
      ['z', 'tail'],
    ])
  })

  it('splits where two spaces stand in the same place on every line', () => {
    expect(
      table(simple('Name   N1  N2', '-------------', 'Alice  a1  b1', '       a2  b2', '', 'Bob    c1  d1')).rows,
    ).toEqual([
      ['Name', 'N1', 'N2'],
      ['Alice', 'a1 a2', 'b1 b2'],
      ['Bob', 'c1', 'd1'],
    ])
  })

  it('counts two tabs, or a tab and a space, as a gap', () => {
    expect(table(simple('aa\t\tbb', 'cc\t\tdd', '------', 'ee\t\tff')).rows).toEqual([
      ['aa cc', 'bb dd'],
      ['ee', 'ff'],
    ])
    expect(table(simple('aa\t bb', 'cc\t dd', '------', 'ee\t ff')).rows).toEqual([
      ['aa cc', 'bb dd'],
      ['ee', 'ff'],
    ])
  })

  it('splits an indented table without an empty first cell', () => {
    const nested = '=begin table :nested\n    aa  bb\n    cc  dd\n    ------\n    ee  ff\n=end table\n'
    expect(table(nested).rows).toEqual([
      ['aa cc', 'bb dd'],
      ['ee', 'ff'],
    ])
    expect(table(simple('  aa  bb', '  cc  dd', '  ------', '  ee  ff')).rows).toEqual([
      ['aa cc', 'bb dd'],
      ['ee', 'ff'],
    ])
  })
})

describe('a row that covers the gap of the header', () => {
  // the header is still cut where its gap is covered; the row below keeps all its text
  it('keeps the cells of the row', () => {
    const { rows, codes } = table(simple('aa  bb', 'cc  dd', '--------', 'eeeeeeee  ff'))
    expect(rows).toEqual([
      ['aa  bb cc  dd', ''],
      ['eeeeeeee', 'ff'],
    ])
    expect(codes).not.toContain('table-row-cells')
  })
})

describe('what stays as it was', () => {
  it('splits rows on one line as before', () => {
    expect(table(simple('Name  Age  City', 'Alice  30  London', 'Bob  25  Paris')).rows).toEqual([
      ['Name', 'Age', 'City'],
      ['Alice', '30', 'London'],
      ['Bob', '25', 'Paris'],
    ])
  })

  it('splits a row written on several lines with three spaces as before', () => {
    expect(
      table(
        simple(
          'Name     Age   City',
          '------   ---   ------',
          'Alice    30    London',
          '         old   town',
          '',
          'Bob      25    Paris',
        ),
      ).rows[1],
    ).toEqual(['Alice', '30  old', 'London town'])
  })

  it('leaves tables with bars or pluses alone', () => {
    expect(table(simple('aa | bb  cc', 'dd | ee  ff', '------------', 'gg | hh  ii')).rows).toEqual([
      ['aa dd', 'bb  cc ee  ff'],
      ['gg', 'hh  ii'],
    ])
    expect(table(simple('aa + bb  cc', 'dd + ee  ff', '------------', 'gg + hh  ii')).rows).toEqual([
      ['aa dd', 'bb  cc ee  ff'],
      ['gg', 'hh  ii'],
    ])
    expect(table(simple('Name | Age   City', 'Alice | 30   London')).rows).toEqual([
      ['Name', 'Age', 'City'],
      ['Alice', '30', 'London'],
    ])
  })

  it('leaves a table that mixes bars and spaces alone', () => {
    expect(
      table(simple('aa | bb   cc', '-------------', 'gg   hhh  ii', 'jj   kkk  ll', '', 'mm   nnn  oo')).rows,
    ).toEqual([
      ['aa', 'bb   cc'],
      ['gg jj', 'hhh  ii kkk  ll'],
      ['mm', 'nnn'],
    ])
    expect(table(simple('aa | bb   cc', 'dd | ee   ff', '-------------', 'gg   hhh  ii')).rows).toEqual([
      ['aa dd', 'bb   cc ee   ff'],
      ['gg', 'hhh'],
    ])
  })

  it('does not split at two spaces another line covers with text', () => {
    expect(
      table(simple('Name     Note', '-------  -----------', 'Alice    a  b c', '         more text', '', 'Bob      x'))
        .rows[1],
    ).toEqual(['Alice', 'a  b c more text'])
  })

  it('keeps a single tab inside a cell', () => {
    expect(table(simple('aa\tbb', 'cc\tdd', '------', 'ee\tff')).rows).toEqual([['aa\tbb cc\tdd'], ['ee\tff']])
  })
})
