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
  it(':folded-levels[2,3] sets foldedLevels for levels 2 and 3', () => {
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

  it(':folded-levels[1] sets foldedLevels for level 1', () => {
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

  it(':folded-levels{2=>1, 3=>0} sets per-level folding state', () => {
    const pod = `
=begin pod
=for toc :folded-levels{2=>1, 3=>0}
head1, head2, head3

=head1 Title
=head2 Subtitle
=head3 Sub-sub
=end pod`
    const tree = parse(pod)
    const tocNode = findTocNode(tree)
    expect(tocNode).not.toBeNull()
    expect(tocNode!.foldedLevels).toEqual({ 2: true, 3: false })
  })

  it(':folded-levels{2=>1, 4=>1, 3=>0} matches spec example', () => {
    const pod = `
=begin pod
=for toc :folded-levels{ 2=>1, 4 => 1, 3=>0 }
head1, head2, head3, item1, item2

=head1 Title
=head2 Subtitle
=head3 Sub-sub
=head4 Sub-sub-sub
=end pod`
    const tree = parse(pod)
    const tocNode = findTocNode(tree)
    expect(tocNode).not.toBeNull()
    expect(tocNode!.foldedLevels).toEqual({ 2: true, 3: false, 4: true })
  })

  it('without :folded-levels foldedLevels is undefined', () => {
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
