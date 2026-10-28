import { podlitePluggable } from '../src/pluggableParser'
import type { ConfigScope, ParseDiagnostic } from '../src'

// the parser of this package, so a run against its earlier source reads that source
const p = podlitePluggable()

type Node = { type?: string; name?: string; value?: unknown; meta?: unknown; content?: unknown }

const isNode = (value: unknown): value is Node => typeof value === 'object' && value !== null && !Array.isArray(value)

const parse = (doc: string, config?: ConfigScope) => {
  const diagnostics: ParseDiagnostic[] = []
  const tree: unknown = p.toAst(p.parse(doc, { podMode: 1, diagnostics, ...(config ? { config } : {}) }))
  return { tree, codes: diagnostics.map(d => d.code) }
}

const textOf = (node: unknown): string => {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (!isNode(node)) return ''
  if (node.type === 'fcode') return `${node.name}<${textOf(node.content)}>`
  if (node.value !== undefined && node.type !== 'number' && node.type !== 'html_named') return String(node.value)
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

const cellsOf = (row: Node): Node[] =>
  (Array.isArray(row.content) ? row.content : []).filter((c): c is Node => isNode(c) && c.name === 'cell')

// each row as the text of its cells, codes written back with their letter
const table = (doc: string, config?: ConfigScope) => {
  const { tree, codes } = parse(doc, config)
  return { rows: rowsOf(tree).map(row => cellsOf(row).map(cell => textOf(cell.content).trim())), codes, tree }
}

const findCode = (node: unknown, name: string): Node | undefined => {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findCode(child, name)
      if (found) return found
    }
    return undefined
  }
  if (!isNode(node)) return undefined
  if (node.type === 'fcode' && node.name === name) return node
  return findCode(node.content, name)
}

const simple = (body: string) => `=begin table\n${body}\n=end table\n`

describe('a markup code closed on its line is part of one cell', () => {
  it('reads the example of the specification as two cells in each row', () => {
    const { rows, codes } = table(
      simple(
        [
          'Selector                        Meaning',
          '==============================  ================================',
          'C<file:article.pod6 | head1>    head1 blocks from article.pod6',
          'C<a  b>                         both spaces stay inside the code',
        ].join('\n'),
      ),
    )
    expect(rows).toEqual([
      ['Selector', 'Meaning'],
      ['C<file:article.pod6 | head1>', 'head1 blocks from article.pod6'],
      ['C<a  b>', 'both spaces stay inside the code'],
    ])
    expect(codes).not.toContain('table-mixed-separators')
  })

  it('keeps the code a node of its own, with all its text', () => {
    const code = findCode(parse(simple('C<file:a.pod6 | head1>    desc\nx    y')).tree, 'C')
    expect(code && textOf(code.content)).toBe('file:a.pod6 | head1')
  })

  it('keeps a bar and spaces inside a code in a table separated by spaces', () => {
    expect(table(simple('C<file:a.pod6 | head1>    desc\nx    y')).rows).toEqual([
      ['C<file:a.pod6 | head1>', 'desc'],
      ['x', 'y'],
    ])
    expect(table('=table\nC<a | b>  desc\n').rows).toEqual([['C<a | b>', 'desc']])
    expect(table(simple('C<a  b>    desc\nx    y')).rows).toEqual([
      ['C<a  b>', 'desc'],
      ['x', 'y'],
    ])
    expect(table(simple('B<I<a | b> c | d>    e\nx    y')).rows).toEqual([
      ['B<I<a | b> c | d>', 'e'],
      ['x', 'y'],
    ])
    expect(table(simple('C<< x<<y>> a | b >>    desc\nx    y')).rows[0]).toEqual(['C< x<<y>> a | b >', 'desc'])
  })

  it('keeps whitespace of any kind inside a code', () => {
    expect(table(simple('C<a  b>    desc\nC<a  b>    desc')).rows).toEqual([
      ['C<a  b>', 'desc'],
      ['C<a  b>', 'desc'],
    ])
    expect(table(simple('C<a\t\tb>    z\nx    y')).rows[0]).toEqual(['C<a\t\tb>', 'z'])
    expect(table(simple('\u{1F600} C<a | b>    z\nC<\u{1F600} | b>    z')).rows).toEqual([
      ['\u{1F600} C<a | b>', 'z'],
      ['C<\u{1F600} | b>', 'z'],
    ])
    // a mask counted in code points would put the gap two units early and cut the code
    expect(table(simple('\u{1F600}\u{1F600}C<a | b>  z\nx  y')).rows[0]).toEqual(['\u{1F600}\u{1F600}C<a | b>', 'z'])
  })

  it('gives a row of two cells where the header has two', () => {
    const { rows, codes } = table('=table\nLeft    Right\nC<a  b>  note\n')
    expect(rows).toEqual([
      ['Left', 'Right'],
      ['C<a  b>', 'note'],
    ])
    expect(codes).not.toContain('table-row-cells')
  })

  it('keeps a bar inside a code in a table separated by bars', () => {
    expect(table(simple('C<file:a.pod6 | head1> | desc')).rows).toEqual([['C<file:a.pod6 | head1>', 'desc']])
    expect(table(simple('B<a | b> | c')).rows).toEqual([['B<a | b>', 'c']])
    expect(table(simple('B<I<a | b>> | c')).rows).toEqual([['B<I<a | b>>', 'c']])
    expect(table(simple('C«a | b» | z')).rows).toEqual([['C<a | b>', 'z']])
    expect(table(simple('C<«a | b»> | z')).rows).toEqual([['C<«a | b»>', 'z']])
  })

  it('keeps a link whole, its text and its address', () => {
    const { rows, tree } = table(simple('L<Docs | https://x> | desc'))
    expect(rows).toEqual([['L<Docs >', 'desc']])
    const link = findCode(tree, 'L')
    expect(link.meta).toBe('https://x')
  })

  it('protects a code closed inside one that is not closed on its line', () => {
    expect(table(simple('B<before I<a | b> after | tail')).rows[0]).toEqual(['B<before I<a | b> after>', 'tail'])
  })

  it('reads the table of selectors of the specification', () => {
    const { rows, codes } = table(
      [
        '=begin table :nested',
        '',
        '    Selector                                        Description',
        '    _______________________________________         ___________________________________________________',
        '    C<head1, head2, item1>                          all head1, head2 and item1 blocks from document',
        '',
        '    C<file:article.pod6 | head1, head2>             all head1 and head2 blocks from article.pod6 file',
        '',
        '    C<file:./includes/*.pod6 | head1, head2>        all head1 and head2 blocks from pod6 files placed ',
        '                                                    in includes directory',
        '',
        '    C<doc:Data::Dumper | code>                      all code blocks from a module documentation',
        '',
        '    C<file:/docs/**/*.md | head1>                   search headers with first level for all ".md" files ',
        '                                                    within the "docs" directory and its subdirectories.',
        '',
        '=end table',
        '',
      ].join('\n'),
    )
    expect(rows).toHaveLength(6)
    rows.forEach(row => expect(row).toHaveLength(2))
    expect(rows[2][0]).toBe('C<file:article.pod6 | head1, head2>')
    expect(codes).not.toContain('table-mixed-separators')
  })

  it('takes the separator of a line from outside its codes, which can change how another line is cut', () => {
    const { rows, codes } = table(simple('C<a | b>\n| x | y |'))
    expect(rows).toEqual([
      ['C<a | b>', ''],
      ['x', 'y'],
    ])
    expect(codes).toContain('table-mixed-separators')
  })

  it('reads a table of three cells written with bars and a code', () => {
    expect(table('=table\nC<a | b> + desc | note\n').rows).toEqual([['C<a | b>', 'desc', 'note']])
  })

  it('reads the control lines of the measurement', () => {
    const cases: Array<[string, string[]]> = [
      ['C<< x<<y>> a | b >>    desc', ['C< x<<y>> a | b >', 'desc']],
      ['C<a<b>c | d>  e', ['C<a<b>c | d>', 'e']],
      ['C<file:a | head1>    desc', ['C<file:a | head1>', 'desc']],
      ['C<a  b>                 desc', ['C<a  b>', 'desc']],
      ['B<a | b> | c', ['B<a | b>', 'c']],
      ['B<I<a | b> c | d>  e', ['B<I<a | b> c | d>', 'e']],
      ['L<x|y> | C<«a | b»> | z', ['L<x>', 'C<«a | b»>', 'z']],
      ['B<I«a>b» | c>    desc', ['B<I<a>b> | c>', 'desc']],
      ['B<before I<a | b> after | tail', ['B<before I<a | b> after>', 'tail']],
    ]
    for (const [line, cells] of cases) {
      expect(table(simple(`${line}\nx    y`)).rows[0]).toEqual(cells)
    }
  })
})

describe('the codes a cell reads decide where a code ends', () => {
  const line = 'C<I«a>b» | c>    desc'

  it('lets a code allowed inside C<> keep the code open', () => {
    expect(table(`=config C<> :allow<I>\n\n${simple(`${line}\nx    y`)}`).rows[0]).toEqual(['C<I<a>b> | c>', 'desc'])
    expect(table(`=config V<> :allow<I>\n\n${simple(`V<I«a>b» | c>    desc\nx    y`)}`).rows[0]).toEqual([
      'V<I<a>b> | c>',
      'desc',
    ])
    expect(table(`=config table :allow<C I>\n=config C<> :allow<I>\n\n${simple(`${line}\nx    y`)}`).rows[0]).toEqual([
      'C<I<a>b> | c>',
      'desc',
    ])
  })

  it('reads settings that come with an included file', () => {
    const config: ConfigScope = { 'C<>': [{ name: 'allow', value: ['I'], type: 'array' }] }
    expect(table(simple(`${line}\nx    y`), config).rows[0]).toEqual(['C<I<a>b> | c>', 'desc'])
  })

  it('takes the set of the cell before the row and the table', () => {
    const doc = `=config C<> :allow<I>\n=config cell :allow<C I>\n=config row :allow<B>\n\n=begin table :allow<B>\n${line}\nx    y\n=end table\n`
    expect(table(doc).rows[0]).toEqual(['C<I<a>b> | c>', 'desc'])
  })

  it('keeps a setting inside the block it was written in', () => {
    const inside = table(`=begin pod\n=config C<> :allow<I>\n\n${simple(`${line}\nx    y`)}\n=end pod\n`).rows[0]
    expect(inside).toEqual(['C<I<a>b> | c>', 'desc'])
    const after = table(
      `=begin nested\n=config C<> :allow<I>\n\ntext\n=end nested\n\n${simple(`${line}\nx    y`)}`,
    ).rows
    expect(after[after.length - 2]).toEqual(['C<I«a>b»', 'c>    desc'])
  })
})

describe('what stays as it was', () => {
  it('cuts a code that is not closed on its line', () => {
    const { rows, codes } = table('=table\nC<a | b | c\n')
    expect(rows).toEqual([['C<a>', 'b', 'c']])
    expect(codes).toContain('markup-code-unclosed')
  })

  it('cuts a line without codes as before', () => {
    expect(table(simple('x + y    desc\np    q')).rows).toEqual([
      ['x', 'y    desc'],
      ['p', 'q'],
    ])
    expect(table(simple('file:x | head1    desc\np    q')).rows).toEqual([
      ['file:x', 'head1    desc'],
      ['p', 'q'],
    ])
  })

  it('does not protect a code closed on the next line', () => {
    expect(table('=table\nC<a | b\nc>    note\n').rows[0]).toEqual(['C<a>', 'b'])
  })

  it('ends C<> at its first closing angle when no code is read inside it', () => {
    expect(table(simple('C<I«a>b» | c>    desc\nx    y')).rows[0]).toEqual(['C<I«a>b»', 'c>    desc'])
  })

  it('reads the codes set on a cell before those of C<>', () => {
    const doc = `=config C<> :allow<I>\n=config cell :allow<C>\n\n${simple('C<I«a>b» | c>    desc\nx    y')}`
    expect(table(doc).rows[0]).toEqual(['C<I«a>b»', 'c>    desc'])
    const row = `=config C<> :allow<I>\n=config row :allow<C>\n\n${simple('C<I«a>b» | c>    desc\nx    y')}`
    expect(table(row).rows[0]).toEqual(['C<I«a>b»', 'c>    desc'])
  })

  it('lets no code protect a separator when the table allows none', () => {
    expect(table('=begin table :allow<>\nC<a | b>    desc\nx    y\n=end table\n').rows[0]).toEqual([
      'C<a',
      'b>    desc',
    ])
  })

  it('does not cut a cell again at the character of an entity', () => {
    const { rows, tree } = table(
      `=config C<> :allow<E>\n\n${simple('C<a E<verbar> b>    desc\nx E<verbar> y    desc')}`,
    )
    expect(rows.map(r => r.length)).toEqual([2, 2])
    expect(findCode(tree, 'E')).toBeDefined()
  })

  it('leaves rows and cells written as blocks alone', () => {
    expect(table('=begin table\n=begin row\n=cell C<a | b>\n=cell desc\n=end row\n=end table\n').rows).toEqual([
      ['C<a | b>', 'desc'],
    ])
  })

  it('keeps the spaces of cells cut by column positions in a table without codes', () => {
    const { tree } = parse('=table\n  | x | y |\n')
    const values = cellsOf(rowsOf(tree)[0]).map(cell =>
      Array.isArray(cell.content) && isNode(cell.content[0]) ? cell.content[0].value : undefined,
    )
    expect(values).toEqual([' x', ' y |'])
  })
})
