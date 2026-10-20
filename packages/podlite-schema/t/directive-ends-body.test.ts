import { toTree } from '..'

type Event = [string, string | undefined, string | undefined, number]

const read = (src: string, podMode = 1): { tree: any[]; events: Event[] } => {
  const recognition: any[] = []
  const tree = toTree().parse(src, { podMode, skipChain: 1, recognition })
  return { tree, events: recognition.map(e => [e.kind, e.marker, e.name, e.location.start.line]) }
}

// each node as its name or type with the text it holds
const shape = (nodes: any[]): any[] =>
  nodes
    .filter(n => n && typeof n === 'object' && n.type !== 'blankline')
    .map(n => {
      if (n.type === 'block') return [n.name, shape(n.content || [])]
      if (n.name === 'row') return ['row', n.value]
      if (n.type === 'verbatim' || n.type === 'text') return n.value
      if (n.type === 'para' || n.type === 'code') return [n.type, n.text]
      return [n.type]
    })

describe('a directive line ends the body of a block whatever its name', () => {
  it('ends a paragraph block at a line that names an unknown block', () => {
    for (const podMode of [1, 0]) {
      expect(shape(read('=for para\ntext\n=begin foo\nx\n=end foo\n', podMode).tree)[0]).toEqual([
        'para',
        [['para', 'text\n']],
      ])
      expect(shape(read('=for para\ntext\n=for foo\nx\n', podMode).tree)[0]).toEqual(['para', [['para', 'text\n']]])
      expect(shape(read('=for para\ntext\n=foo bar\n', podMode).tree)[0]).toEqual(['para', [['para', 'text\n']]])
    }
  })

  it('ends an abbreviated block the same way', () => {
    expect(shape(read('=para text\n=begin foo\nx\n=end foo\n').tree)).toEqual([
      ['para', [['para', 'text\n']]],
      ['para', '=begin foo\nx\n'],
      ['para', '=end foo\n'],
    ])
  })

  it('ends a verbatim body of a paragraph or abbreviated block', () => {
    expect(shape(read('=for code\nx\n=begin foo\ny\n=end foo\n').tree)[0]).toEqual(['code', ['x\n']])
    const { tree, events } = read('=code x\n=for foo\ny\n')
    expect(shape(tree)).toEqual([
      ['code', ['x\n']],
      ['para', '=for foo\ny\n'],
    ])
    expect(events).toEqual([['unknown-directive', 'for', 'foo', 2]])
  })

  it('ends a paragraph or abbreviated table, not a delimited one', () => {
    expect(shape(read('=for table\na b\nc d\n=for foo\nx\n').tree)[0]).toEqual([
      'table',
      [
        ['row', 'a b\n'],
        ['row', 'c d\n'],
      ],
    ])
    expect(shape(read('=table\na b\n=foo x\n').tree)[0]).toEqual(['table', [['row', 'a b\n']]])
    expect(shape(read('=begin table\n=video stream yes\na b\n=end table\n').tree)[0]).toEqual([
      'table',
      [
        ['row', '=video stream yes\n'],
        ['row', 'a b\n'],
      ],
    ])
  })

  it('ends an implicit paragraph and implicit code', () => {
    expect(shape(read('text\n=for foo\nbar\n').tree)).toEqual([
      ['para', 'text\n'],
      ['para', '=for foo\nbar\n'],
    ])
    expect(shape(read('=begin pod\n  code\n=for foo\nbar\n=end pod\n').tree)[0]).toEqual([
      'pod',
      [
        ['code', 'code\n'],
        ['para', '=for foo\nbar\n'],
      ],
    ])
  })

  it('keeps the rest of a directive line as data of an abbreviated block', () => {
    const { tree, events } = read('=code =future text\nnext\n=for foo\ny\n')
    expect(shape(tree)[0]).toEqual(['code', ['=future text\nnext\n']])
    expect(events).toEqual([['unknown-directive', 'for', 'foo', 3]])
    expect(shape(read('=table =future text\na b\n=for foo\n').tree)[0]).toEqual([
      'table',
      [
        ['row', '=future text\n'],
        ['row', 'a b\n'],
      ],
    ])
  })

  it('reads the rest of an abbreviated verbatim line that names a known block as data', () => {
    expect(shape(read('=code =para hello\n').tree)).toEqual([['code', ['=para hello\n']]])
    expect(shape(read('=React =para hello\n').tree)).toEqual([['React', ['=para hello\n']]])
  })

  it('separates an assertion from an unknown block that follows it inside a test', () => {
    const { tree, events } = read(
      '=begin test\n=begin fixture\n=head1 A\n=end fixture\n=for assert\nhead1\n=begin cases\nx\n=end cases\n=end test\n',
    )
    expect(shape(tree)).toEqual([
      [
        'test',
        [
          ['fixture', ['=head1 A\n']],
          ['assert', ['head1\n']],
          ['para', '=begin cases\nx\n'],
          ['para', '=end cases\n'],
        ],
      ],
    ])
    expect(events).toEqual([
      ['unknown-directive', 'begin', 'cases', 7],
      ['unknown-directive', 'end', 'cases', 9],
    ])
  })

  it('ends a body at a directive line after a lone carriage return or a CRLF', () => {
    expect(shape(read('=for para\nx\r=for head1\ny\r').tree)).toEqual([
      ['para', [['para', 'x\r']]],
      ['head1', [['para', 'y\r']]],
    ])
    expect(shape(read('=for para\r\nx\r\n=for foo\r\ny\r\n').tree)).toEqual([
      ['para', [['para', 'x\r\n']]],
      ['para', '=for foo\r\ny\r\n'],
    ])
  })
})

describe('what a directive line of an unknown name leaves as it was', () => {
  it('ends a block at a known name and a mixed-case name', () => {
    expect(shape(read('=for para\ntext\n=for head1\nbar\n').tree)[0]).toEqual(['para', [['para', 'text\n']]])
    expect(shape(read('=for para\ntext\n=begin Foo\nx\n=end Foo\n').tree)).toEqual([
      ['para', [['para', 'text\n']]],
      ['Foo', ['x\n']],
    ])
  })

  it('reports a standalone unknown block on both of its lines', () => {
    expect(read('=begin foo\nx\n=end foo\n').events).toEqual([
      ['unknown-directive', 'begin', 'foo', 1],
      ['unknown-directive', 'end', 'foo', 3],
    ])
  })

  it('keeps ambient text of the default mode in one piece', () => {
    expect(shape(read('Some code\n=foo bar\nmore code\n', 0).tree)).toEqual([['ambient']])
  })
})
