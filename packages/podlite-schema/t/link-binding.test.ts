import { podlitePluggable } from '../src/pluggableParser'
import { bindTarget, buildBindingIndex } from '../src/ast-helpers'
import { frozenIds } from '../src/pluggableParser'

const index = (src: string) => {
  const p = podlitePluggable()
  return buildBindingIndex(p.toAst(p.parse(`=begin pod\n\n${src}\n\n=end pod\n`, { podMode: 1 })))
}

describe('binding an address to a block by :id', () => {
  it('binds a written :id and not one written without a value', () => {
    expect(bindTarget('true', index('=for para :id\nText.')).found).toBe(false)
    expect(bindTarget('true', index('=for para :id<true>\nText.')).found).toBe(true)
  })
})

describe('binding a heading by the name it was parsed with', () => {
  // a plugin that runs after parsing — the publisher's links plugin, say — may change what a
  // heading says, while the table of contents still links to the name the heading was parsed with
  const parsed = (src: string) => {
    const p = podlitePluggable()
    const tree = p.toAst(p.parse(`=begin pod\n\n${src}\n\n=end pod\n`, { podMode: 1 }))
    const blocks: any[] = []
    const walk = (node: any) => {
      if (Array.isArray(node)) return node.forEach(walk)
      if (!node || typeof node !== 'object') return
      if (node.type === 'block') blocks.push(node)
      walk(node.content)
    }
    walk(tree)
    return { tree, blocks, heads: blocks.filter(node => node.name === 'head') }
  }

  it('finds a heading whose text changed after parsing by its parsed name', () => {
    const { tree, heads } = parsed('=head1 About L<doc:Target> here')
    heads[0].content = ['About Target here']
    const bound = bindTarget('About doc:Target here', buildBindingIndex(tree))
    expect(bound.found && bound.node).toBe(heads[0])
  })

  it('finds it when the parsed name holds a decomposed letter', () => {
    const { tree, heads } = parsed('=head1 Café L<doc:Target>')
    heads[0].content = ['Café Target']
    const bound = bindTarget('Café doc:Target', buildBindingIndex(tree))
    expect(bound.found && bound.node).toBe(heads[0])
  })

  it('does not take an address another heading already answers to, nor call it ambiguous', () => {
    // the first heading was parsed as Foo-bar and its text changed; the second one's anchor is Foo-bar
    const { tree, heads } = parsed('=for head1 :id<other>\nFoo-bar\n\n=head1 Foo bar')
    heads[0].content = ['Renamed']
    const bound = bindTarget('Foo-bar', buildBindingIndex(tree))
    expect(bound.found && bound.node).toBe(heads[1])
    expect(bound.found && bound.ambiguous).toBe(false)
  })

  it('leaves a shaped address with the heading it belongs to', () => {
    // the first heading was parsed as foo-bar-x; only the shaped form of the second answers to it
    const { tree, heads } = parsed('=for head1 :id<first>\nfoo-bar-x\n\n=for head1 :id<second>\nFoo Bar x')
    heads[0].content = ['Renamed']
    const bound = bindTarget('foo-bar-x', buildBindingIndex(tree))
    expect(bound.found && bound.node).toBe(heads[1])
    expect(bound.found && bound.ambiguous).toBe(false)
  })

  it('gives no address to the generated id of a block that is not a heading, nor to an empty one', () => {
    const { tree, blocks, heads } = parsed('=head1 Kept\n\n=para A paragraph.')
    const para = blocks.find(node => node.name === 'para')
    expect(typeof para.id).toBe('string')
    expect(bindTarget(para.id, buildBindingIndex(tree)).found).toBe(false)
    heads[0].id = ''
    expect(buildBindingIndex(tree).byKey.has('')).toBe(false)
  })

  it('adds no ambiguity to a tree whose ids were frozen for a test', () => {
    const p = podlitePluggable()
    const tree = frozenIds()(p.toAst(p.parse('=begin pod\n\n=head1 One\n\n=head1 Two\n\n=end pod\n', { podMode: 1 })))
    expect([...buildBindingIndex(tree).ambiguous]).toEqual([])
  })
})
