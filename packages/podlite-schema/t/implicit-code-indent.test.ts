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
  })
})
