import { frozenIds, getFromTree, parseAttributes } from '@podlite/schema'
import type { ParseDiagnostic, RecognitionEvent } from '@podlite/schema'
import { podlite, readerFor } from '../src'

const p = podlite({ importPlugins: true })
const read = readerFor(p, { body: block => block.name === 'React' })
const plain = readerFor(p)

// an implicit paragraph is a node of its own kind
const blocksOf = (node: any): any[] =>
  (node.content as any[]).filter(child => child && (child.type === 'block' || child.type === 'para'))
const react = (tree: any, n = 0): any => getFromTree(tree, 'React')[n]
const names = (node: any): string[] => blocksOf(node).map(child => child.name ?? child.type)
// a place in a text, counted the way the parser counts
const at = (text: string, offset: number) => {
  const before = text.slice(0, offset).split('\n')
  return { offset, line: before.length, column: before[before.length - 1].length + 1 }
}
// the blocks of a body, each with the text its place starts at and the place it ends at
const placesOf = (text: string, block: any) =>
  blocksOf(block).map(child => {
    const { start, end } = child.location
    expect(start).toEqual(at(text, start.offset))
    expect(end).toEqual(at(text, end.offset))
    return [child.name ?? child.type, text.slice(start.offset).split('\n')[0], text.slice(end.offset).split('\n')[0]]
  })

describe('the body of a block the host names', () => {
  it('becomes the blocks of that block', () => {
    const tree = read('=begin pod\n=begin React :component<A>\n=para one\n\n=head2 Two\n=end React\n=end pod\n', 'a')
    expect(names(react(tree))).toEqual(['para', 'head'])
    expect(react(tree).config.map(item => item.name)).toEqual(['component'])
  })

  it('is read with the settings declared before the block', () => {
    const text =
      '=begin pod\n=config code :allow<B>\n\n=begin React\n=begin code\nB<x>\n=end code\n=end React\n=end pod\n'
    expect(JSON.stringify(react(read(text, 'a')))).toContain('"fcode"')
    expect(JSON.stringify(react(plain(text, 'a')))).not.toContain('"fcode"')
  })

  it('is read with the settings handed to the reader', () => {
    const text = '=begin pod\n=begin React\n=begin code\nB<x>\n=end code\n=end React\n=end pod\n'
    expect(JSON.stringify(react(read(text, 'a', { code: parseAttributes(':allow<B>') })))).toContain('"fcode"')
    expect(JSON.stringify(react(read(text, 'a')))).not.toContain('"fcode"')
  })

  it('holds a body of its own read the same way', () => {
    const text =
      '=begin pod\n=config code :allow<B>\n\n=begin React\n=para outer\n\n  =begin React\n  =begin code\n  B<x>\n  =end code\n  =end React\n=end React\n=end pod\n'
    const tree = read(text, 'a')
    const inner = react(tree, 1)
    expect(names(react(tree))).toEqual(['para', 'React'])
    expect(names(inner)).toEqual(['code'])
    expect(JSON.stringify(inner)).toContain('"fcode"')
    expect(placesOf(text, inner)).toEqual([['code', '=begin code', '  =end React']])
  })
})

describe('the places of the blocks of a body', () => {
  it('are their places in the text', () => {
    const text = '=begin pod\n=begin React :a<1>\n=            :b<2>\n=para one\n\n=head2 Two\n=end React\n=end pod\n'
    const block = react(read(text, 'a'))
    expect(block.config.map(item => item.name)).toEqual(['a', 'b'])
    expect(placesOf(text, block)).toEqual([
      ['para', '=para one', ''],
      ['head', '=head2 Two', '=end React'],
    ])
  })

  it('end at the closing marker when the body is one line', () => {
    const text = '=begin pod\n=begin React\n=para one\n=end React\n=end pod\n'
    expect(placesOf(text, react(read(text, 'a')))).toEqual([['para', '=para one', '=end React']])
  })

  it('count the indent of the block', () => {
    const text = '=begin pod\n  =begin React\n  =para one\n\n  =head2 Two\n  =end React\n=end pod\n'
    expect(placesOf(text, react(read(text, 'a')))).toEqual([
      ['para', '=para one', ''],
      ['head', '=head2 Two', '  =end React'],
    ])
  })

  it('are found in a paragraph block', () => {
    const text = '=begin pod\n=for React :a<1>\nfirst line\nsecond line\n\n=para after\n=end pod\n'
    expect(placesOf(text, react(read(text, 'a')))).toEqual([['para', 'first line', '']])
  })

  it('are found in an abbreviated block', () => {
    const text = '=begin pod\n=React first line\nsecond line\n\n=para after\n=end pod\n'
    expect(placesOf(text, react(read(text, 'a')))).toEqual([['para', 'first line', '']])
  })

  it('are found in an indented abbreviated block', () => {
    const text = '=begin pod\n  =React first line\n  second line\n\n=para after\n=end pod\n'
    expect(placesOf(text, react(read(text, 'a')))).toEqual([['para', 'first line', '']])
  })

  it('are found in a block the text ends with', () => {
    const text = '=begin React\n=para one\n=end React'
    expect(placesOf(text, react(read(text, 'a')))).toEqual([['para', '=para one', '=end React']])
  })
})

describe('what the reading of a body reports', () => {
  it('comes in the list of recognition events, placed in the text', () => {
    const text = '=begin pod\n=begin React\n=para one\n\n=unknownblock text\n=end React\n=end pod\n'
    const recognition: RecognitionEvent[] = []
    read(text, 'a', undefined, { recognition })
    expect(recognition.map(event => [event.kind, text.slice(event.location.start.offset).split('\n')[0]])).toEqual([
      ['unknown-directive', '=unknownblock text'],
    ])
  })

  it('comes with the diagnostics of the document, placed in the text', () => {
    const text =
      '=begin pod\n=begin React\n=begin table\n=begin row :header\n=cell A\n=cell B\n=cell C\n=end row\n=begin row\n=cell 1\n=end row\n=end table\n=end React\n=end pod\n'
    const tree: any = read(text, 'a')
    const shown = (tree.diagnostics as ParseDiagnostic[]).map(item => {
      expect(item.location.start).toEqual(at(text, item.location.start.offset))
      return [item.code, text.slice(item.location.start.offset).split('\n')[0]]
    })
    expect(shown).toEqual([['table-row-cells', '=begin table']])
    const diagnostics: ParseDiagnostic[] = []
    const again: any = read(text, 'a', undefined, { diagnostics })
    expect(diagnostics.map(item => item.code)).toEqual(['table-row-cells'])
    expect(again.diagnostics).toEqual(diagnostics)
  })
})

describe('a body that is not to be read', () => {
  it('is left as it was when its lines are not found in the text', () => {
    const text = '=begin pod\n=begin React\n=para one\n=end React\n=end pod\n'
    const odd = {
      parse: p.parse,
      toAst: (tree, options) => {
        const made: any = p.toAst(tree, options)
        const [block] = getFromTree(made, 'React') as any[]
        if (block) block.content = [{ type: 'verbatim', value: '=para other\n' }]
        return made
      },
    } as typeof p
    const block = react(readerFor(odd, { body: node => node.name === 'React' })(text, 'a'))
    expect(block.content).toEqual([{ type: 'verbatim', value: '=para other\n' }])
  })

  it('is left as it was in a block the host does not name', () => {
    const text = '=begin pod\n=begin Other\n=para one\n=end Other\n=end pod\n'
    const [block] = getFromTree(read(text, 'a'), 'Other') as any[]
    expect(block.content).toEqual([{ type: 'verbatim', value: '=para one\n' }])
  })

  it('keeps the settings it declares to itself', () => {
    const text =
      '=begin pod\n=begin React\n=config code :allow<B>\n\n=para one\n=end React\n\n=begin code\nB<x>\n=end code\n=end pod\n'
    const [code] = getFromTree(read(text, 'a'), 'code')
    expect(JSON.stringify(code)).not.toContain('"fcode"')
  })

  it('is read once', () => {
    let parsed = 0
    const counting = { parse: (...args) => (parsed++, p.parse(...(args as [string]))), toAst: p.toAst } as typeof p
    const text = '=begin pod\n=begin React\n  =begin React\n  =para one\n  =end React\n=end React\n=end pod\n'
    readerFor(counting, { body: node => node.name === 'React' })(text, 'a')
    expect(parsed).toBe(3)
  })

  it('is no part of a Markdown file', () => {
    const md = readerFor(p, { format: () => 'md', body: () => true })
    const same = readerFor(p, { format: () => 'md' })
    expect(frozenIds()(md('# Title\n', 'a.md'))).toEqual(frozenIds()(same('# Title\n', 'a.md')))
  })
})
