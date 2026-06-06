import { podlitePluggable } from '../src/pluggableParser'
import { makeAttrs } from '../src/helpers/config'
import { propagateConfigDefaults } from '../src/helpers/configPropagation'

const findHeads = (node: any, out: any[] = []): any[] => {
  if (Array.isArray(node)) {
    node.forEach(n => findHeads(n, out))
    return out
  }
  if (!node || typeof node !== 'object') return out
  if (node.type === 'block' && node.name === 'head') out.push(node)
  if (node.content) findHeads(node.content, out)
  return out
}

const parseToAst = (src: string) => {
  const p = podlitePluggable()
  return p.toAst(p.parse(src, { podMode: 1 }))
}

describe('=config block preconfiguration propagation', () => {
  it('applies =config defaults to subsequent matching block', () => {
    const ast = parseToAst(`
=config head2 :folded

=head2 X
`)
    const heads = findHeads(ast)
    expect(heads.length).toBe(1)
    const conf = makeAttrs(heads[0])
    expect(conf.exists('folded')).toBe(true)
  })

  it('own attribute on the block overrides =config default', () => {
    const ast = parseToAst(`
=config head2 :folded

=for head2 :!folded
Not folded
`)
    const heads = findHeads(ast)
    expect(heads.length).toBe(1)
    const conf = makeAttrs(heads[0])
    const folded = conf.getFirstValue('folded')
    expect(folded === false || folded === 0 || folded === '0').toBe(true)
  })

  it('propagates multiple attributes from one =config', () => {
    const ast = parseToAst(`
=config head1 :numbered :folded

=head1 Top
`)
    const heads = findHeads(ast)
    const conf = makeAttrs(heads[0])
    expect(conf.exists('numbered')).toBe(true)
    expect(conf.exists('folded')).toBe(true)
  })

  it('later =config replaces earlier for the same block name', () => {
    const ast = parseToAst(`
=config head2 :folded

=config head2 :numbered

=head2 X
`)
    const heads = findHeads(ast)
    const conf = makeAttrs(heads[0])
    expect(conf.exists('numbered')).toBe(true)
    expect(conf.exists('folded')).toBe(false)
  })

  it('does not affect blocks of a different type', () => {
    const ast = parseToAst(`
=config head2 :folded

=head3 Y
`)
    const heads = findHeads(ast)
    expect(heads.length).toBe(1)
    expect(heads[0].level).toBe('3')
    const conf = makeAttrs(heads[0])
    expect(conf.exists('folded')).toBe(false)
  })

  it('only affects blocks that come after the =config in source order', () => {
    const ast = parseToAst(`
=head2 Before

=config head2 :folded

=head2 After
`)
    const heads = findHeads(ast)
    expect(heads.length).toBe(2)
    expect(makeAttrs(heads[0]).exists('folded')).toBe(false)
    expect(makeAttrs(heads[1]).exists('folded')).toBe(true)
  })

  it('is a no-op when called directly on an AST without =config nodes', () => {
    const ast = parseToAst(`=head2 Plain`)
    const before = JSON.stringify(ast)
    propagateConfigDefaults(ast)
    expect(JSON.stringify(ast)).toBe(before)
  })
})
