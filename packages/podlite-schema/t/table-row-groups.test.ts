import { podlitePluggable } from '../src'

type Node = { type?: unknown; name?: unknown; value?: unknown; content?: unknown }
const isNode = (value: unknown): value is Node => Boolean(value) && typeof value === 'object'
const textOf = (node: unknown): string => {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (!isNode(node)) return ''
  return typeof node.value === 'string' ? node.value : textOf(node.content)
}

const parsed = (body: string) => {
  const p = podlitePluggable()
  const tree = p.toAst(p.parse(`=begin pod\n${body}=end pod\n`, { podMode: 1 }))
  const rows: string[][] = []
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!isNode(node)) return
    if (node.type === 'block' && node.name === 'row' && Array.isArray(node.content)) {
      rows.push(node.content.filter(isNode).map(cell => textOf(cell.content).replace(/\s+/g, ' ').trim()))
      return
    }
    walk(node.content)
  }
  walk(tree)
  return { rows, codes: (tree.diagnostics || []).map(d => d.code) }
}
const table = (lines: string[]) => `=begin table\n${lines.join('\n')}\n=end table\n`

describe('rows on several lines held apart by separators', () => {
  it('make the lines after the last separator one row', () => {
    expect(parsed(table([' H1 | H2', ' ===+===', ' a1 | b1', ' a2 | b2', ' ---+---', ' c1 | d1', ' c2 | d2']))).toEqual(
      {
        rows: [
          ['H1', 'H2'],
          ['a1 a2', 'b1 b2'],
          ['c1 c2', 'd1 d2'],
        ],
        codes: [],
      },
    )
  })

  it('make every group a row in a table with no header', () => {
    const groups = [' a1 | b1', ' a2 | b2', ' ---+---', ' c1 | d1', ' c2 | d2', ' ---+---', ' e1 | f1', ' e2 | f2']
    const rows = [
      ['a1 a2', 'b1 b2'],
      ['c1 c2', 'd1 d2'],
      ['e1 e2', 'f1 f2'],
    ]
    expect(parsed(table(groups))).toEqual({ rows, codes: [] })
    expect(parsed(table([...groups, ' ---+---']))).toEqual({ rows, codes: [] })
  })

  it('take blank lines as separators, with plus and with spaces alone', () => {
    expect(parsed(table([' H1  H2', ' ==  ==', ' a1  b1', ' a2  b2', '', ' c1  d1', ' c2  d2'])).rows).toEqual([
      ['H1', 'H2'],
      ['a1 a2', 'b1 b2'],
      ['c1 c2', 'd1 d2'],
    ])
    expect(
      parsed(table([' H1 + H2', ' ===+===', ' a1 + b1', ' a2 + b2', ' ---+---', ' c1 + d1', ' c2 + d2'])).rows,
    ).toEqual([
      ['H1', 'H2'],
      ['a1 a2', 'b1 b2'],
      ['c1 c2', 'd1 d2'],
    ])
  })

  it('read the same in a table written with =table', () => {
    expect(parsed('=table\n H1 | H2\n ===+===\n a1 | b1\n a2 | b2\n ---+---\n c1 | d1\n c2 | d2\n').rows).toEqual([
      ['H1', 'H2'],
      ['a1 a2', 'b1 b2'],
      ['c1 c2', 'd1 d2'],
    ])
  })

  it('read the same in a paragraph table', () => {
    expect(parsed('=for table\n H1 | H2\n ===+===\n a1 | b1\n a2 | b2\n ---+---\n c1 | d1\n c2 | d2\n').rows).toEqual([
      ['H1', 'H2'],
      ['a1 a2', 'b1 b2'],
      ['c1 c2', 'd1 d2'],
    ])
  })

  it('join a row whose lines carry a code example', () => {
    const shown = [
      ' Written                     Parsed',
      ' =========================   ==================',
      ' C«=begin code»              three nodes, no pod',
      ' C«=begin code :lang<js>»',
      ' demo',
      ' C«=end code»',
      ' C«=end code»',
      ' -------------------------   ------------------',
      ' C«=begin code»              one clean tree',
      ' ` =begin code :lang<js>`',
      ' ` demo`',
      ' ` =end code`',
      ' C«=end code»',
    ]
    const { rows, codes } = parsed(table(shown))
    expect(rows.length).toBe(3)
    expect(rows[2][1]).toBe('one clean tree')
    expect(codes).toEqual([])
  })
})

describe('rows with no separator between groups', () => {
  it('stay a row on each line', () => {
    expect(parsed(table([' H1 | H2', ' ===+===', ' a1 | b1', ' c1 | d1', ' e1 | f1'])).rows).toEqual([
      ['H1', 'H2'],
      ['a1', 'b1'],
      ['c1', 'd1'],
      ['e1', 'f1'],
    ])
  })

  it('stay a row on each line when one group ends with a separator or a blank line', () => {
    const rows = [
      ['H', 'J'],
      ['a1', 'b1'],
      ['a2', 'b2'],
    ]
    expect(parsed(table([' H | J', ' ===+===', ' a1 | b1', ' a2 | b2', ' ---+---'])).rows).toEqual(rows)
    expect(parsed(table([' H | J', ' ===+===', ' a1 | b1', ' a2 | b2', ''])).rows).toEqual(rows)
  })

  it('stay a row on each line in a table with no header and no separator', () => {
    expect(parsed(table([' a1 | b1', ' a2 | b2', ' a3 | b3'])).rows).toEqual([
      ['a1', 'b1'],
      ['a2', 'b2'],
      ['a3', 'b3'],
    ])
  })

  it('keep the rows of a table made of =row and =cell', () => {
    const src =
      '=begin table\n=begin row\n=cell a\n=cell b\n=end row\n=begin row\n=cell c\n=cell d\n=end row\n=end table\n'
    expect(parsed(src).rows).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })
})
