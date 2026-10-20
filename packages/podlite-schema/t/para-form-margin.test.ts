import { toTree, toMarkdown } from '..'

const inPod = (body: string): string => `=begin pod\n${body}=end pod\n`

const tree = (src: string, skipChain = 1): any[] => toTree().parse(src, { podMode: 1, skipChain })

// the block inside =begin pod, through a list wrapper where the chain made one
const inner = (src: string, skipChain = 1): any => {
  const [pod] = tree(inPod(src), skipChain)
  const [first] = pod.content.filter((n: any) => n.type !== 'blankline')
  return first.type === 'list' ? first.content[0] : first
}

const verbatimOf = (block: any): string => block.content.map((c: any) => c.value).join('')
const textOf = (block: any): string => block.content.map((c: any) => c.text).join('')

describe('the virtual margin of an indented paragraph or abbreviated block', () => {
  it('leaves a verbatim body of a paragraph block as the delimited form leaves it', () => {
    for (const name of ['code', 'data']) {
      const delimited = verbatimOf(inner(`  =begin ${name}\n  plain\n    deeper\n  =end ${name}\n`))
      expect(delimited).toBe('plain\n  deeper\n')
      expect(verbatimOf(inner(`  =for ${name}\n  plain\n    deeper\n`))).toBe(delimited)
    }
  })

  it('takes the margin off a fixture in paragraph form', () => {
    const [test] = tree('=begin test\n  =for fixture\n  plain\n    deeper\n=end test\n')
    const fixture = test.content.find((n: any) => n.name === 'fixture')
    expect(verbatimOf(fixture)).toBe('plain\n  deeper\n')
  })

  it('takes the margin off the lines after the directive line of an abbreviated block', () => {
    expect(verbatimOf(inner('  =code plain\n    deeper\n'))).toBe('plain\n  deeper\n')
    expect(verbatimOf(inner('  =code =para hello\n    deeper\n'))).toBe('=para hello\n  deeper\n')
  })

  it('takes the margin off every line of a paragraph, an item and a heading', () => {
    expect(textOf(inner('  =for para\n  plain\n    deeper\n'))).toBe('plain\n  deeper\n')
    expect(textOf(inner('  =item plain\n    deeper\n'))).toBe('plain\n  deeper\n')
    expect(textOf(inner('  =for item\n  plain\n    deeper\n'))).toBe('plain\n  deeper\n')
    expect(textOf(inner('  =for head1\n  plain\n    deeper\n'))).toBe('plain\n  deeper\n')
  })

  it('keeps an item a paragraph when its first line is set in beyond the margin', () => {
    const item = inner('  =for item\n      first\n        more\n')
    expect(item.content.map((c: any) => c.type)).toEqual(['para'])
    expect(textOf(item)).toBe('    first\n      more\n')
  })

  it('takes the margin off a definition, and off its term in paragraph form', () => {
    const abbreviated = inner('  =defn plain\n    deeper\n', 0)
    expect(abbreviated.content.map((c: any) => c.text)).toEqual(['plain', '  deeper\n'])
    const paragraph = inner('  =for defn\n  plain\n    deeper\n', 0)
    expect(paragraph.content.map((c: any) => c.text)).toEqual(['plain', '  deeper\n'])
  })

  it('writes an indented item to Markdown without the margin', () => {
    expect(toMarkdown({}).run(inPod('  =item plain\n    deeper\n')).toString()).toBe('- plain\n  deeper\n\n')
  })

  it('takes the margin off lines that end in a lone carriage return', () => {
    const [pod] = tree('=begin pod\r  =for code\r  plain\r    deeper\r=end pod\r')
    const [code] = pod.content.filter((n: any) => n.type !== 'blankline')
    expect(verbatimOf(code)).toBe('plain\r  deeper\r')
  })

  it('reads a line set in less than the margin from the margin', () => {
    expect(verbatimOf(inner('  =for code\n  plain\n deeper\n'))).toBe('plain\ndeeper\n')
  })
})

describe('what the margin of an indented block leaves as it was', () => {
  it('keeps a block with no indent and a delimited verbatim block', () => {
    expect(verbatimOf(inner('=for code\nplain\n  deeper\n'))).toBe('plain\n  deeper\n')
    expect(verbatimOf(inner('  =begin code\n  plain\n    deeper\n  =end code\n'))).toBe('plain\n  deeper\n')
  })
})
