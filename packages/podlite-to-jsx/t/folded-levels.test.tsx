import { TestPodlite as Podlite } from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const root = { innerHTML: '' }
function render(jsx) {
  root.innerHTML = renderToStaticMarkup(jsx)
  return root.innerHTML
}

describe(':folded-levels rendering in JSX (per-item conditional fold)', () => {
  it('folded level wraps only items that have nested children', () => {
    render(
      <Podlite>
        {`
=begin pod
=for toc :folded-levels[2]
head1, head2, head3

=head1 Top
=head2 With children
=head3 Child
=head2 Leaf one
=head2 Leaf two
=end pod`}
      </Podlite>,
    )
    // Item "With children" has nested head3 → wrapped in <details>
    expect(root.innerHTML).toContain('<details class="toc-fold">')
    expect(root.innerHTML).toContain('toc-item-foldable')
    // Leaves render as plain <li> without foldable class
    const leafOnePos = root.innerHTML.indexOf('Leaf one')
    const leafTwoPos = root.innerHTML.indexOf('Leaf two')
    expect(leafOnePos).toBeGreaterThan(-1)
    expect(leafTwoPos).toBeGreaterThan(-1)
    // Count foldables: only one (the "With children" item)
    const foldableCount = (root.innerHTML.match(/toc-item-foldable/g) || []).length
    expect(foldableCount).toBe(1)
  })

  it('summary contains the item link, children rendered inside <details>', () => {
    render(
      <Podlite>
        {`
=begin pod
=for toc :folded-levels[2]
head1, head2, head3

=head1 Top
=head2 Parent
=head3 Child
=end pod`}
      </Podlite>,
    )
    // Summary has an anchor link to the heading and NO inner <p> wrapper
    // (so the triangle and link render on the same line).
    expect(root.innerHTML).toMatch(/<summary[^>]*><a[^>]*href="#Parent"[^>]*>Parent/)
    expect(root.innerHTML).not.toMatch(/<summary[^>]*><p>/)
    // Child appears inside the details body (after the summary close tag)
    const details = root.innerHTML.split('<details class="toc-fold">')[1] || ''
    expect(details).toContain('Child')
  })

  it('without :folded-levels renders plain list (backward compat)', () => {
    render(
      <Podlite>
        {`
=begin pod
=for toc :caption('TOC')
head1, head2

=head1 Title
=head2 Sub-section
=end pod`}
      </Podlite>,
    )
    expect(root.innerHTML).not.toContain('<details')
    expect(root.innerHTML).toContain('toc-list')
  })

  it('folded level with no children-having items produces no <details>', () => {
    render(
      <Podlite>
        {`
=begin pod
=for toc :folded-levels[2]
head1, head2

=head1 Top
=head2 Only leaf A
=head2 Only leaf B
=end pod`}
      </Podlite>,
    )
    expect(root.innerHTML).not.toContain('<details class="toc-fold"')
    expect(root.innerHTML).toContain('Only leaf A')
    expect(root.innerHTML).toContain('Only leaf B')
  })

  it(':folded-levels{2=>1, 3=>0} key-value only folds level 2 items with children', () => {
    render(
      <Podlite>
        {`
=begin pod
=for toc :folded-levels{2=>1}
head1, head2, head3

=head1 Top
=head2 Parent
=head3 Child
=head2 Leaf
=end pod`}
      </Podlite>,
    )
    // Only "Parent" is foldable (has nested head3)
    const foldableCount = (root.innerHTML.match(/toc-item-foldable/g) || []).length
    expect(foldableCount).toBe(1)
    expect(root.innerHTML).toContain('Leaf')
  })

  it('=toc :folded (bare) wraps entire TOC in <details> (collapsed)', () => {
    render(
      <Podlite>
        {`
=begin pod
=for toc :folded :caption('Contents')
head1, head2

=head1 Title
=head2 Subtitle
=end pod`}
      </Podlite>,
    )
    expect(root.innerHTML).toContain('<details class="toc toc-fold-all"')
    expect(root.innerHTML).not.toContain('<details class="toc toc-fold-all" open')
    expect(root.innerHTML).toContain('<summary class="toctitle">Contents</summary>')
  })

  it('=toc :!folded renders as <details open> disclosure', () => {
    render(
      <Podlite>
        {`
=begin pod
=for toc :!folded :caption('TOC')
head1, head2

=head1 Title
=head2 Subtitle
=end pod`}
      </Podlite>,
    )
    expect(root.innerHTML).toContain('<details class="toc toc-fold-all" open="')
  })

  it('=toc :folded without :caption uses default "Contents" label', () => {
    render(
      <Podlite>
        {`
=begin pod
=for toc :folded
head1

=head1 Title
=end pod`}
      </Podlite>,
    )
    expect(root.innerHTML).toContain('<summary class="toctitle">Contents</summary>')
  })

  it('full document with :folded-levels[2,3] renders correctly (snapshot)', () => {
    render(
      <Podlite>
        {`
=begin pod
=for toc :folded-levels[2,3] :caption('Contents')
head1, head2, head3

=head1 Introduction

First section content.

=head2 Background

Background details.

=head3 History

Historical context.

=head1 Conclusion

Final thoughts.
=end pod`}
      </Podlite>,
    )
    expect(root.innerHTML).toMatchSnapshot()
  })
})
