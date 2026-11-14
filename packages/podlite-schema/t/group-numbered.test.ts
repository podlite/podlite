import { podlitePluggable } from '../src/pluggableParser'

// the tree is read by field, so a test needs no cast
const field = (node: unknown, key: string): unknown =>
  typeof node === 'object' && node !== null ? Reflect.get(node, key) : undefined
const kids = (node: unknown): unknown[] => {
  const content = field(node, 'content')
  return Array.isArray(content) ? content : []
}
const text = (node: unknown): string => {
  if (typeof node === 'string') return node
  const value = field(node, 'value')
  return (typeof value === 'string' ? value : '') + kids(node).map(text).join('')
}
const parse = (src: string): unknown => {
  const p = podlitePluggable()
  return p.toAst(p.parse(src))
}
// the first word of an item or a definition, enough to tell them apart
const word = (node: unknown) =>
  text(kids(node).find(c => field(c, 'type') !== 'blankline'))
    .trim()
    .split(/\s+/)[0]
// what stands at one level: a list with the words of its members, or a directive by its type
const level = (nodes: unknown[]): unknown[] =>
  nodes
    .filter(n => field(n, 'type') !== 'blankline')
    .map(n =>
      field(n, 'type') === 'list'
        ? [
            field(n, 'list'),
            kids(n)
              .filter(c => field(c, 'type') === 'block')
              .map(word),
          ]
        : [field(n, 'type'), field(n, 'name')],
    )
const top = (src: string) => level(kids(parse(src)))
const html = (src: string) => {
  const p = podlitePluggable()
  return String(p.toHtml(p.toAst(p.parse(src))))
}
const markdown = (src: string) => {
  const p = podlitePluggable()
  return String(p.toMarkdown(p.toAst(p.parse(src))))
}

describe('definitions are grouped by their own numbering', () => {
  it.each([
    [
      'a numbered one before a plain one',
      '=for defn :numbered\nX\nx\n=defn Y\ny\n',
      [
        ['variable', ['X']],
        ['variable', ['Y']],
      ],
    ],
    [
      'a plain one before a numbered one',
      '=defn Y\ny\n=for defn :numbered\nX\nx\n',
      [
        ['variable', ['Y']],
        ['variable', ['X']],
      ],
    ],
    [
      'one numbered by a leading #',
      '=defn # X\nx\n=defn Y\ny\n',
      [
        ['variable', ['X']],
        ['variable', ['Y']],
      ],
    ],
  ])('splits %s', (_, src, lists) => {
    expect(top(src)).toEqual(lists)
  })

  it.each([
    ['an unnumbered one', '=for defn :!numbered\nA\na\n=defn B\nb\n'],
    ['one numbered by zero', '=for defn :numbered(0)\nA\na\n=defn B\nb\n'],
  ])('keeps %s with a plain one in one list', (_, src) => {
    expect(top(src)).toEqual([['variable', ['A', 'B']]])
  })

  it.each([
    [
      'numbered, then unnumbered, stays with a plain one',
      '=for defn :numbered :!numbered\nA\na\n=defn B\nb\n',
      [['variable', ['A', 'B']]],
    ],
    [
      'unnumbered, then numbered, stands apart',
      '=for defn :!numbered :numbered\nA\na\n=defn B\nb\n',
      [
        ['variable', ['A']],
        ['variable', ['B']],
      ],
    ],
  ])('reads the last numbered of a definition: %s', (_, src, lists) => {
    expect(top(src)).toEqual(lists)
  })

  it('splits definitions numbered by =config from one that says otherwise', () => {
    expect(top('=config defn :numbered\n\n=defn A\na\n=for defn :!numbered\nB\nb\n')).toEqual([
      ['config', 'defn'],
      ['variable', ['A']],
      ['variable', ['B']],
    ])
  })
})

describe('a directive named defn stays out of the lists', () => {
  it.each([
    [
      '=config right before a definition',
      '=config defn :numbered\n=defn Y\ny\n',
      [
        ['config', 'defn'],
        ['variable', ['Y']],
      ],
    ],
    [
      '=config between two definitions',
      '=defn A\na\n=config defn :numbered\n=defn B\nb\n',
      [
        ['variable', ['A']],
        ['config', 'defn'],
        ['variable', ['B']],
      ],
    ],
    [
      '=alias right before a definition',
      '=alias defn x\n=defn Y\ny\n',
      [
        ['alias', 'defn'],
        ['variable', ['Y']],
      ],
    ],
    [
      'a lone =config',
      '=config defn :numbered\n\n=para text\n',
      [
        ['config', 'defn'],
        ['block', 'para'],
      ],
    ],
  ])('%s', (_, src, nodes) => {
    expect(top(src)).toEqual(nodes)
  })

  it('leaves no empty list in HTML', () => {
    expect(html('=config defn :numbered\n\n=para text\n')).not.toContain('<dl>')
  })
})

describe('items are grouped by the value of numbered', () => {
  it.each([
    ['unnumbered', '=for item :!numbered\nA\n'],
    ['numbered by zero', '=for item :numbered(0)\nA\n'],
    ['numbered by the text 0', '=for item :numbered<0>\nA\n'],
    ['numbered by the text false', '=for item :numbered<false>\nA\n'],
    ['numbered, then unnumbered', '=for item :numbered :!numbered\nA\n'],
    ['unnumbered by =config', '=config item :!numbered\n\n=item A\n'],
    ['unnumbered by =set', '=set :!numbered\n=item A\n'],
  ])('makes a bullet list of an item %s', (_, src) => {
    expect(top(src).filter(n => Array.isArray(n[1]))).toEqual([['itemized', ['A']]])
  })

  it('makes a numbered list of an item unnumbered, then numbered', () => {
    expect(top('=for item :!numbered :numbered\nA\n')).toEqual([['ordered', ['A']]])
  })

  it('splits an item numbered by =config from one that says otherwise', () => {
    expect(top('=config item :numbered\n\n=item a\n=for item :!numbered\nb\n')).toEqual([
      ['config', 'item'],
      ['ordered', ['a']],
      ['itemized', ['b']],
    ])
  })

  it('makes a task list of an unnumbered item with a check box', () => {
    expect(top('=for item :!numbered\n[x] a\n')).toEqual([['task', ['a']]])
  })

  it('splits nested items of different numbering on their own level', () => {
    const [outer] = kids(parse('=item1 A\n=for item2 :!numbered\nB\n=for item2 :numbered\nC\n'))
    expect(field(outer, 'list')).toBe('itemized')
    const nested = kids(outer).filter(n => field(n, 'type') === 'list')
    expect(word(outer)).toBe('A')
    expect(nested.map(n => [field(n, 'list'), field(n, 'level'), level(kids(n))])).toEqual([
      ['itemized', '2', [['block', 'item']]],
      ['ordered', '2', [['block', 'item']]],
    ])
    expect(
      nested.map(n =>
        kids(n)
          .filter(c => field(c, 'type') === 'block')
          .map(word),
      ),
    ).toEqual([['B'], ['C']])
  })

  it('writes a bullet and a numbered list in HTML and Markdown', () => {
    const src = '=for item :!numbered\nA\n=for item :numbered\nB\n'
    expect(html(src)).toMatch(/<ul>.*A.*<\/ul><ol>.*B.*<\/ol>/s)
    expect(markdown(src)).toMatch(/^- A\n[\s\S]*^1\. B/m)
  })
})

describe('the grouping that stays as it was', () => {
  it.each([
    ['numbered items in a row', '=for item :numbered\nA\n=for item :numbered\nB\n', [['ordered', ['A', 'B']]]],
    ['items numbered by a leading #', '=item # A\n=item # B\n', [['ordered', ['A', 'B']]]],
    ['plain definitions in a row', '=defn A\na\n=defn B\nb\n', [['variable', ['A', 'B']]]],
    [
      'definitions apart by a blank line',
      '=defn A\na\n\n=defn B\nb\n',
      [
        ['variable', ['A']],
        ['variable', ['B']],
      ],
    ],
    [
      'items numbered by =config',
      '=config item :numbered\n\n=item A\n=item B\n',
      [
        ['config', 'item'],
        ['ordered', ['A', 'B']],
      ],
    ],
  ])('%s', (_, src, nodes) => {
    expect(top(src)).toEqual(nodes)
  })
})
