import { podlitePluggable } from '@podlite/schema'
import { PluginRegister } from '../src'

const headingIn = (source: string): string => {
  const p = podlitePluggable({ plugins: PluginRegister })
  const found: any[] = []
  const visit = (node: any): void => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(visit)
    if (node.type === 'block' && node.name === 'head') found.push(node)
    visit(node.content)
  }
  visit(p.toAst(p.parse(source, { podMode: 1 })))
  const [head] = found
  return `${head.location.start.line}:${source.slice(head.location.start.offset, head.location.end.offset)}`
}

describe('the place of a block read from a Markdown section', () => {
  it('is its line and offsets in the file, in each form of the section', () => {
    expect([
      headingIn('=pod\n\n=begin markdown\nText.\n\n# Title\n=end markdown\n'),
      headingIn('=pod\n\n=for markdown\nText.\n# Title\n'),
      headingIn('=pod\n\n=markdown\n# Title\n'),
      headingIn('=pod\n\n  =begin markdown\n  Text.\n  # Title\n  =end markdown\n'),
    ]).toEqual(['6:# Title', '5:# Title', '4:# Title', '5:# Title'])
  })
})
