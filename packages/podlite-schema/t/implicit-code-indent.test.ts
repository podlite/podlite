import { getFromTree, toHtml, toMarkdown } from '../src'
import { podlitePluggable } from '../src/pluggableParser'

const read = (src: string) => {
  const p = podlitePluggable()
  return p.toAst(p.parse(src, { podMode: 1 }))
}
const codeOf = (src: string) => {
  const [code] = getFromTree(read(src), (n: any) => n && n.type === 'code') as any[]
  return code
}
const inPod = (lines: string[]) => ['=begin pod', '', 'Text.', '', ...lines, '', '=end pod', ''].join('\n')
const atRoot = (lines: string[]) => ['Text.', '', ...lines, ''].join('\n')
const html = (src: string) => String(toHtml({}).run(read(src))).match(/<pre><code>([\s\S]*?)<\/code><\/pre>/)?.[1]
const markdown = (src: string) => String(toMarkdown({}).run(read(src))).match(/```\n([\s\S]*?)```/)?.[1]

// Specification.pod6, Code blocks: code has an implicit nesting, and is rendered without
// rejustification; the indent that opened it is the nesting
describe('an implicit code block', () => {
  const lines = ['    first', '    second', '      inner']
  it.each([
    ['inside =pod', inPod(lines)],
    ['at the root of a document', atRoot(lines)],
  ])('%s loses the indent of its first line on every line, in the tree and in the output', (_, src) => {
    const code = codeOf(src)
    expect(code.content).toEqual([expect.objectContaining({ type: 'verbatim', value: 'first\nsecond\n  inner\n' })])
    expect(code.text).toBe('first\nsecond\n  inner\n')
    expect(html(src)).toBe('first\nsecond\n  inner\n')
    expect(markdown(src)).toBe('first\nsecond\n  inner\n')
  })

  // Specification.pod6: leading tabs align to tabstops every 8 columns
  it.each([
    ['a tab, then eight spaces', ['\tfirst', '        second'], 'first\nsecond\n'],
    ['eight spaces, then a tab', ['        first', '\tsecond'], 'first\nsecond\n'],
    ['a tab past the indent', ['    first', '\tsecond'], 'first\n    second\n'],
    ['a tab after the indent', ['    first', '    \tsecond'], 'first\n    second\n'],
    ['two tabs', ['    first', '\t\tsecond'], 'first\n            second\n'],
  ])('counts the indent in columns: %s', (_, body, expected) => {
    expect(codeOf(inPod(body)).content[0].value).toBe(expected)
  })

  it.each([
    ['no-break space', ' '],
    ['em quad', ' '],
    ['form feed', '\u000C'],
    ['punctuation space', ' '],
  ])('takes off an indent of %s as the grammar reads it', (_, ch) => {
    expect(codeOf(inPod([`${ch}${ch}first`, `${ch}${ch}second`])).content[0].value).toBe('first\nsecond\n')
  })

  it('loses all of a shorter indent on a line set in less than the first', () => {
    expect(codeOf(inPod(['    first', '  second', 'third'])).content[0].value).toBe('first\nsecond\nthird\n')
  })

  it('in a nested block loses the margin of the block and its own indent', () => {
    const src = [
      '=begin pod',
      '',
      '  =begin nested',
      '  Text.',
      '',
      '      first',
      '      second',
      '  =end nested',
      '',
      '=end pod',
      '',
    ].join('\n')
    expect(codeOf(src).content[0].value).toBe('first\nsecond\n')
  })

  it('with codes allowed is read after the indent is gone', () => {
    const src = [
      '=begin pod',
      '',
      '=config code :allow<B>',
      '',
      'Text.',
      '',
      '    B<first',
      '    second>',
      '    third',
      '',
      '=end pod',
      '',
    ].join('\n')
    expect(html(src)).toBe('<strong>first\nsecond</strong>\nthird\n')
  })

  it.each(['item', 'defn'])('in a delimited =%s loses the indent the same way', name => {
    const src = [
      '=begin pod',
      '',
      `=begin ${name}`,
      'Text.',
      '',
      '    first',
      '    second',
      `=end ${name}`,
      '',
      '=end pod',
      '',
    ].join('\n')
    expect(codeOf(src).content[0].value).toBe('first\nsecond\n')
  })

  // Specification.pod6, the table after "The resulting table is rendered as follows:"
  it('in the table example of the specification is written even', () => {
    const table = [
      '    ---------------------------------------------------------------',
      '    |         Item and Quantity        |     Description          |',
      '    |----------------------------------|--------------------------|',
      '    |   Apples     |      5            |                          |',
      '    |--------------|-------------------|    Fruit for snacking    |',
      '    |   Bananas    |      3            |                          |',
      '    ---------------------------------------------------------------',
    ]
    const out = String(
      html(
        ['=begin pod', '', 'The resulting table is rendered as follows:', '', ...table, '', '=end pod', ''].join('\n'),
      ),
    )
    expect(out.split('\n').filter(Boolean)).toEqual(table.map(line => line.slice(4)))
  })
})

describe('an implicit code block keeps as before', () => {
  it('a single line', () => {
    expect(codeOf(inPod(['    one line'])).content[0].value).toBe('one line\n')
  })

  it('indented text of a =for item, which is a paragraph', () => {
    const tree = read(['=begin pod', '', '=for item', '    Install the package first.', '', '=end pod', ''].join('\n'))
    expect(getFromTree(tree, (n: any) => n && n.type === 'code')).toEqual([])
    const [item] = getFromTree(tree, 'item') as any[]
    expect(JSON.stringify(item.content)).toContain('Install the package first.')
    expect(getFromTree(item, (n: any) => n && n.type === 'para')).toHaveLength(1)
  })
})

const kinds = (src: string) =>
  (read(src) as any).content
    .filter((n: any) => n.type === 'block')
    .map((b: any) => b.content.filter((n: any) => n.type === 'code' || n.type === 'para').map((n: any) => n.type))

// Specification.pod6, Code blocks: implicit code within =pod, =item, =defn, =nested or a semantic block
describe('text set in from the margin of a block', () => {
  it.each([['SYNOPSIS'], ['AUTHORS'], ['DESCRIPTION']])('is code in the semantic block %s', name => {
    expect(kinds(`=begin ${name}\nPlain.\n\n    sample\n=end ${name}\n`)).toEqual([['para', 'code']])
  })

  it('is code in =begin nested, as before', () => {
    expect(kinds('=begin nested\nPlain.\n\n    sample\n=end nested\n')).toEqual([['para', 'code']])
  })

  it('stays a paragraph in =begin para and in a test', () => {
    expect(kinds('=begin para\nPlain.\n\n    sample\n=end para\n')).toEqual([['para', 'para']])
    expect(kinds('=begin test\nPlain.\n\n    sample\n\n=assert para\n=end test\n')).toEqual([['para', 'para']])
  })
})

// Specification.pod6, General syntactic structure: leading tabs align to tabstops every 8 characters
describe('a leading tab in the margin', () => {
  it('reaches the next multiple of 8, so a tab and a space go past a margin of 8 spaces', () => {
    expect(kinds('        =begin nested\n\t x\n        =end nested\n')).toEqual([['code']])
  })

  it('takes as many columns as 8 spaces, so a tab alone stays at a margin of 8 spaces', () => {
    expect(kinds('        =begin nested\n\tx\n        =end nested\n')).toEqual([['para']])
  })

  it('counts columns, not characters, in the margin of the block and of the line', () => {
    const src = ' \t=begin nested\n\t B<x>\n \t=end nested\n'
    expect(kinds(src)).toEqual([['code']])
    expect(codeOf(src).text).toBe('B<x>\n')
  })

  it('of a directive is as wide as 8 spaces of the line under it', () => {
    expect(kinds('\t=begin pod\n        Ask.\n\t=end pod\n')).toEqual([['para']])
  })
})

// Specification.pod6, Definition lists: the first non-blank line of content is the term
describe('the first line of a =begin defn', () => {
  it('is its term when it is set in past the margin', () => {
    const tree: any = read('        =begin defn\n\t TERM\n\n        Definition.\n        =end defn\n')
    const terms = getFromTree(tree, (n: any) => n && n.name === 'term') as any[]
    expect(terms.map(t => t.text)).toEqual(['TERM'])
    expect(String(toHtml({}).run(tree))).toContain('Definition.')
  })

  it('leaves the rest of its indented lines as code that starts on the next line', () => {
    const src = '        =begin defn\n\t TERM\n\t sample\n        =end defn\n'
    const code = codeOf(src)
    expect(code.text).toBe('sample\n')
    expect(code.location.start.line).toBe(3)
    expect(src.slice(code.location.start.offset, code.location.end.offset)).toBe('\t sample\n')
  })

  it('ends its term at a lone carriage return', () => {
    const terms = getFromTree(
      read('=begin defn\n  TERM\r  B<x>\n=end defn\n'),
      (n: any) => n && n.name === 'term',
    ) as any[]
    expect(terms.map(t => t.text)).toEqual(['TERM'])
  })
})
