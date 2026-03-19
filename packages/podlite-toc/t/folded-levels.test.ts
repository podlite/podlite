import { PodliteDocument, podlitePluggable, Toc } from '@podlite/schema'
import { plugin } from '../src/index'

const parse = (str: string): PodliteDocument => {
  let podlite = podlitePluggable().use({
    toc: plugin,
  })
  let tree = podlite.parse(str)
  const asAst = podlite.toAstResult(tree)
  return asAst.interator
}

// Recursively find first node with type === 'toc'
const findTocNode = (node: any): Toc | null => {
  if (!node) return null
  if (node.type === 'toc') return node as Toc
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      const found = findTocNode(child)
      if (found) return found
    }
  }
  return null
}

describe(':folded-levels for =toc', () => {
  it('T1: :folded-levels[2,3] - foldedLevels: {2: true, 3: true}', () => {
    const pod = `
=begin pod
=for toc :folded-levels[2,3]
head1, head2, head3

=head1 Title
=head2 Subtitle
=head3 Sub-sub
=end pod`
    const tree = parse(pod)
    const tocNode = findTocNode(tree)
    expect(tocNode).not.toBeNull()
    expect(tocNode!.foldedLevels).toEqual({ 2: true, 3: true })
  })

  it('T2: :folded-levels[1] - foldedLevels: {1: true}', () => {
    const pod = `
=begin pod
=for toc :folded-levels[1]
head1, head2

=head1 Title
=head2 Subtitle
=end pod`
    const tree = parse(pod)
    const tocNode = findTocNode(tree)
    expect(tocNode).not.toBeNull()
    expect(tocNode!.foldedLevels).toEqual({ 1: true })
  })

  it('T3: no :folded-levels - foldedLevels is undefined', () => {
    const pod = `
=begin pod
=for toc :caption('TOC')
head1, head2

=head1 Title
=head2 Subtitle
=end pod`
    const tree = parse(pod)
    const tocNode = findTocNode(tree)
    expect(tocNode).not.toBeNull()
    expect(tocNode!.foldedLevels).toBeUndefined()
  })
})
