import { getTextContentFromNode, markGuarded, PodliteDocument, podlitePluggable, Toc } from '@podlite/schema'
import { plugin, rebuildToc } from '../src/index'

const parse = (str: string): PodliteDocument => {
  const podlite = podlitePluggable().use({ toc: plugin })
  return podlite.toAstResult(podlite.parse(str)).interator
}

const findBlock = (node: any, name: string): any => {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findBlock(child, name)
      if (found) return found
    }
    return null
  }
  if (node.type === 'block' && node.name === name) return node
  return findBlock(node.content, name)
}

const tocOf = (directive: any): Toc => directive.content.find((c: any) => c && c.type === 'toc')

// the text of every entry, depth first
const entries = (toc: Toc): string[] => {
  const out: string[] = []
  const walk = (node: any): void => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(walk)
    if (node.type === 'toc-item') out.push(String(getTextContentFromNode(node.node)).trim())
    walk(node.content)
  }
  walk(toc.content)
  return out
}

// the document with a heading added after it was built, as an include would add one
const withAdded = (tree: any, heading: string, level = 1): any => {
  const added = parse(`=head${level} ${heading}\n`)
  return { ...tree, content: [...tree.content, ...added.content] }
}

describe('a table of contents built again over a tree that gained blocks', () => {
  it('keeps the selector it was built by', () => {
    expect(tocOf(findBlock(parse('=toc head1, head2\n\n=head1 A\n'), 'toc')).selector).toBe('head1, head2')
  })

  it('lists a heading added to the tree', () => {
    const tree = withAdded(parse('=toc head1\n\n=head1 Own\n'), 'Added')
    const rebuilt = rebuildToc(findBlock(tree, 'toc'), tree)
    expect(entries(tocOf(rebuilt))).toEqual(['Own', 'Added'])
  })

  it('reads the folded levels from the block again', () => {
    const tree = withAdded(parse('=for toc :folded-levels(2)\nhead1, head2\n\n=head1 Own\n'), 'Inner', 2)
    const rebuilt = tocOf(rebuildToc(findBlock(tree, 'toc'), tree))
    expect(rebuilt.foldedLevels).toEqual({ 2: true })
    expect(entries(rebuilt)).toEqual(['Own', 'Inner'])
  })

  it('keeps the caption and the folded state', () => {
    const tree = withAdded(parse("=for toc :caption('Contents') :folded\nhead1\n\n=head1 Own\n"), 'Added')
    const rebuilt = tocOf(rebuildToc(findBlock(tree, 'toc'), tree))
    expect(rebuilt.title).toBe('Contents')
    expect(rebuilt.folded).toBe(true)
  })

  it('leaves a table that carries no selector as it is', () => {
    const tree = parse('=toc head1\n\n=head1 Own\n')
    const directive = findBlock(tree, 'toc')
    const { selector, ...old } = tocOf(directive)
    const before = { ...directive, content: [old] }
    const grown = withAdded({ ...tree, content: [before, ...tree.content.slice(1)] }, 'Added')
    expect(rebuildToc(before, grown)).toBe(before)
  })

  it('keeps no selector from a line that holds a markup code, and so is not built again', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const tree = parse('=toc B<head1>\n\n=head1 Own\n')
    warn.mockRestore()
    const directive = findBlock(tree, 'toc')
    expect(tocOf(directive).selector).toBeUndefined()
    expect(rebuildToc(directive, withAdded(tree, 'Added'))).toBe(directive)
  })

  it('reports a selector with a source as when it was parsed', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const tree = parse('=toc file:x.podlite | head1\n\n=head1 Own\n')
    const rebuilt = tocOf(rebuildToc(findBlock(tree, 'toc'), withAdded(tree, 'Added')))
    const said = warn.mock.calls.map(c => String(c[0]))
    warn.mockRestore()
    expect(entries(rebuilt)).toEqual([])
    expect(said.filter(s => s.includes('lists the blocks of its own document'))).toHaveLength(2)
  })

  it('hides an added heading the tree marks as hidden', () => {
    const tree = parse('=toc head1\n\n=head1 Own\n')
    const hidden = parse('=begin pod :masked\n\n=head1 Secret\n\n=end pod\n')
    const grown = markGuarded({ ...tree, content: [...tree.content, ...hidden.content] })
    const rebuilt = tocOf(rebuildToc(findBlock(grown, 'toc'), grown))
    expect(JSON.stringify(rebuilt)).toMatch(/"value":"Secret[^"]*","guarded":true/)
  })

  it('does not list the table being built', () => {
    const tree = withAdded(parse('=toc toc, head1\n\n=head1 Own\n'), 'Added')
    const rebuilt = tocOf(rebuildToc(findBlock(tree, 'toc'), tree))
    expect(entries(rebuilt)).toEqual(['Own', 'Added'])
  })
})
