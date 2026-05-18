import { toHtml, toMarkdown } from '../src'
var parse = require('..').parse

const renderHtml = (pod: string): string => toHtml({}).run(pod).toString()
const renderMd = (pod: string): string => toMarkdown({}).run(pod).toString()

const findBlock = (tree: any, name: string): any => {
  if (!Array.isArray(tree)) return undefined
  for (const node of tree) {
    if (!node || typeof node !== 'object') continue
    if (node.name === name) return node
    if (Array.isArray(node.content)) {
      const found = findBlock(node.content, name)
      if (found) return found
    }
  }
  return undefined
}

describe('=boundary directive', () => {
  it('parses bare =boundary as block with name boundary', () => {
    const src = `=begin pod
=head1 Chapter One

=boundary

=head1 Chapter Two
=end pod`
    const tree = parse(src, { podMode: 1 })
    const node = findBlock(tree, 'boundary')
    expect(node).toBeDefined()
    expect(node.type).toBe('block')
  })

  it('preserves :caption attribute in config', () => {
    const src = `=begin pod
=boundary :caption('Part Two')
=end pod`
    const tree = parse(src, { podMode: 1 })
    const node = findBlock(tree, 'boundary')
    expect(node).toBeDefined()
    const caption = (node.config || []).find((c: any) => c.name === 'caption')
    expect(caption).toBeDefined()
    expect(caption.value).toBe('Part Two')
  })

  it('HTML renders =boundary as <hr>', () => {
    const html = renderHtml('=pod\n=boundary\n')
    expect(html).toContain('<hr>')
  })

  it('HTML includes :caption as title attribute', () => {
    const html = renderHtml("=pod\n=boundary :caption('Part Two')\n")
    expect(html).toContain('<hr title="Part Two">')
  })

  it('Markdown renders =boundary as thematic break', () => {
    const md = renderMd('=pod\n=boundary\n')
    expect(md).toContain('---')
  })
})
