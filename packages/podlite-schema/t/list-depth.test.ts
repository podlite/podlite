import { podlitePluggable } from '../src'
import { MAX_LIST_LEVEL } from '../src'

type Node = { type?: unknown; name?: unknown; level?: unknown; config?: unknown; content?: unknown }
const isNode = (value: unknown): value is Node => Boolean(value) && typeof value === 'object'

const levels = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `=item${from + i} x${from + i}\n\n`).join('')
const parse = (src: string) => {
  const p = podlitePluggable()
  const tree = p.toAst(p.parse(src, { podMode: 1 }))
  const items: Node[] = []
  let depth = 0
  const walk = (node: unknown, lists: number): void => {
    if (Array.isArray(node)) return node.forEach(n => walk(n, lists))
    if (!isNode(node)) return
    const inner = node.type === 'list' ? lists + 1 : lists
    depth = Math.max(depth, inner)
    if (node.type === 'block' && node.name === 'item') items.push(node)
    walk(node.content, inner)
  }
  walk(tree, 0)
  const deep = (tree.diagnostics || []).filter(d => d.code === 'list-too-deep')
  return { items, depth, deep, codes: (tree.diagnostics || []).map(d => d.code) }
}

describe('a list nested deeper than the parser builds', () => {
  it('is built no deeper than its limit, with every item in its place', () => {
    for (const src of [levels(1, 1000), `=begin pod\n\n${levels(1, 1000)}=end pod\n`]) {
      const { items, depth, deep } = parse(src)
      expect(items.map(item => String(item.level))).toEqual(Array.from({ length: 1000 }, (_, i) => String(i + 1)))
      expect(depth).toBe(MAX_LIST_LEVEL)
      expect(deep.map(d => d.message)).toEqual([
        `list item at level ${
          MAX_LIST_LEVEL + 1
        } is deeper than ${MAX_LIST_LEVEL} levels; it is shown at level ${MAX_LIST_LEVEL}`,
      ])
    }
  })

  it('reports the first item past the limit at its place', () => {
    const { deep } = parse(levels(1, MAX_LIST_LEVEL + 2))
    expect(deep.length).toBe(1)
    expect(deep[0].location.start.line).toBe(2 * MAX_LIST_LEVEL + 1)
  })

  it('says nothing up to the limit and once past it', () => {
    expect(parse(levels(1, MAX_LIST_LEVEL - 1)).deep).toEqual([])
    expect(parse(levels(1, MAX_LIST_LEVEL))).toMatchObject({ deep: [], depth: MAX_LIST_LEVEL })
    expect(parse(levels(1, MAX_LIST_LEVEL + 1))).toMatchObject({ depth: MAX_LIST_LEVEL })
    expect(parse(levels(1, MAX_LIST_LEVEL + 1)).deep.length).toBe(1)
    expect(parse(levels(1, MAX_LIST_LEVEL + 2)).deep.length).toBe(1)
  })

  it('reports once for each list', () => {
    const deepList = levels(1, MAX_LIST_LEVEL + 3)
    expect(parse(`${deepList}=para between\n\n${deepList}`).deep.length).toBe(2)
    expect(parse(`${deepList}=begin nested\n\n${deepList}=end nested\n`).deep.length).toBe(2)
    expect(parse(`${levels(1, MAX_LIST_LEVEL + 1)}=item${MAX_LIST_LEVEL + 2} :numbered x\n\n`).deep.length).toBe(1)
    expect(parse(`=begin item\n\n${deepList}=end item\n`).deep.length).toBe(1)
  })

  it('keeps the kinds of the items past the limit in a list that starts at the limit', () => {
    const src =
      `${levels(1, MAX_LIST_LEVEL - 1)}=para between\n\n` +
      `=item${MAX_LIST_LEVEL} a\n\n=item${MAX_LIST_LEVEL + 1} # b\n\n=item${MAX_LIST_LEVEL + 2} [ ] c\n\n=item${
        MAX_LIST_LEVEL + 3
      } d\n\n`
    const p = podlitePluggable()
    const tree = p.toAst(p.parse(src, { podMode: 1 }))
    const kinds: unknown[] = []
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk)
      if (!isNode(node)) return
      if (node.type === 'list' && 'list' in node) kinds.push(node.list)
      walk(node.content)
    }
    walk(tree)
    expect(kinds.slice(-4)).toEqual(['itemized', 'ordered', 'task', 'itemized'])
  })

  it('keeps the level the author wrote and the settings of that level', () => {
    const at = MAX_LIST_LEVEL + 10
    const src = `=config item${at} :numbered\n\n${levels(1, at + 1)}`
    const { items } = parse(src)
    const numbered = (node: Node) =>
      Array.isArray(node.config) && node.config.some(c => isNode(c) && 'name' in c && c.name === 'numbered')
    expect(String(items[at - 1].level)).toBe(String(at))
    expect(numbered(items[at - 1])).toBe(true)
    expect(numbered(items[at])).toBe(false)
  })

  it('reports both an unreadable value of a deep item and the depth', () => {
    const src = `${levels(1, MAX_LIST_LEVEL)}=for item${MAX_LIST_LEVEL + 1} :tags[a,b]\nx\n`
    expect(parse(src).codes).toEqual(['value-unreadable', 'list-too-deep'])
  })
})
