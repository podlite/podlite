import { podlite } from '../src'
import { getFromTree } from '@podlite/schema'

describe('podlite().parse front-door', () => {
  it('mode: md routes through markdown parser and produces head nodes', () => {
    const p = podlite({ importPlugins: false })
    const ast = p.parse('# Heading\n\nA paragraph.\n', { mode: 'md' })
    const heads = getFromTree(ast, 'head')
    expect(heads).toHaveLength(1)
    expect(heads[0]).toMatchObject({ name: 'head', level: 1 })
  })

  it('mode: md recognises h1-h6', () => {
    const p = podlite({ importPlugins: false })
    const ast = p.parse('# A\n## B\n### C\n#### D\n##### E\n###### F\n', { mode: 'md' })
    const heads = getFromTree(ast, 'head')
    expect(heads).toHaveLength(6)
    const levels = heads.flatMap(h => (typeof h === 'object' && 'level' in h ? [Number(h.level)] : []))
    expect(levels).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('podMode: 1 (default) uses pod grammar', () => {
    const p = podlite({ importPlugins: false })
    const ast = p.parse('=head1 Title\n', { podMode: 1 })
    const heads = getFromTree(ast, 'head')
    expect(heads).toHaveLength(1)
    expect(heads[0]).toMatchObject({ name: 'head' })
  })

  it('podMode: 0 remains lenient pod (no markdown dispatch without mode flag)', () => {
    const p = podlite({ importPlugins: false })
    const ast = p.parse('# Not a markdown heading in pod mode\n', { podMode: 0 })
    expect(getFromTree(ast, 'head')).toHaveLength(0)
  })

  it('no opt argument defaults to pod', () => {
    const p = podlite({ importPlugins: false })
    const ast = p.parse('=head1 Hi\n')
    expect(getFromTree(ast, 'head')).toHaveLength(1)
  })

  it('mode: pod is equivalent to no mode (pod grammar)', () => {
    const p = podlite({ importPlugins: false })
    const ast = p.parse('=head1 Hi\n', { mode: 'pod' })
    expect(getFromTree(ast, 'head')).toHaveLength(1)
  })
})
