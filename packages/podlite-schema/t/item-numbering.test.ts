import { podlitePluggable } from '../src/pluggableParser'

const findLists = (node: any, out: any[] = []): any[] => {
  if (Array.isArray(node)) {
    node.forEach(n => findLists(n, out))
    return out
  }
  if (!node || typeof node !== 'object') return out
  if (node.type === 'list') out.push(node)
  if (node.content) findLists(node.content, out)
  return out
}

const parseToAst = (src: string) => {
  const p = podlitePluggable()
  return p.toAst(p.parse(src, { podMode: 1 }))
}

describe('item numbering pre-pass', () => {
  it('promotes list to ordered when items inherit :numbered from =config', () => {
    const ast = parseToAst(`
=config item1 :numbered

=item1 first
=item1 second
=item1 third
`)
    const lists = findLists(ast)
    expect(lists).toHaveLength(1)
    expect(lists[0].list).toBe('ordered')
  })

  it('does not promote when inherited config carries an unrelated attribute', () => {
    const ast = parseToAst(`
=config item1 :folded

=item1 first
=item1 second
`)
    const lists = findLists(ast)
    expect(lists).toHaveLength(1)
    expect(lists[0].list).toBe('itemized')
  })

  it('does not touch lists without inherited :numbered', () => {
    const ast = parseToAst(`
=item1 first
=item1 second
`)
    const lists = findLists(ast)
    expect(lists).toHaveLength(1)
    expect(lists[0].list).toBe('itemized')
  })

  it('explicit per-item :numbered still produces ordered (no regression)', () => {
    const ast = parseToAst(`
=for item1 :numbered
first
=for item1 :numbered
second
`)
    const lists = findLists(ast)
    expect(lists).toHaveLength(1)
    expect(lists[0].list).toBe('ordered')
  })

  it('# prefix shorthand produces ordered (no regression)', () => {
    const ast = parseToAst(`
=item1 # first
=item1 # second
`)
    const lists = findLists(ast)
    expect(lists).toHaveLength(1)
    expect(lists[0].list).toBe('ordered')
  })

  it('promotes nested lists independently per level', () => {
    const ast = parseToAst(`
=config item1 :numbered
=config item2 :numbered

=item1 outer
=item2 inner
=item2 inner two
=item1 outer two
`)
    const lists = findLists(ast)
    expect(lists.length).toBeGreaterThanOrEqual(2)
    expect(lists.every(l => l.list === 'ordered')).toBe(true)
  })
})
