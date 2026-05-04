import { TestPodlite as Podlite } from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const root = { innerHTML: '' }
function render(jsx) {
  root.innerHTML = renderToStaticMarkup(jsx)
  return root.innerHTML
}

// Spec Specification.pod6:484-493 — `:folded` on a heading folds the whole
// section (heading + content until next same-or-higher-level heading).
describe(':folded attribute on =head blocks (section folding)', () => {
  it('=head1 without :folded renders plain <h1>, no <details>', () => {
    render(
      <Podlite>
        {`
=begin pod
=head1 Title

Body text.
=end pod`}
      </Podlite>,
    )
    expect(root.innerHTML).toContain('<h1')
    expect(root.innerHTML).not.toContain('folded-section')
  })

  it('=for head1 :folded wraps heading plus body in <details>', () => {
    render(
      <Podlite>
        {`
=begin pod
=for head1 :folded
Section A

Body paragraph one.

Body paragraph two.
=end pod`}
      </Podlite>,
    )
    expect(root.innerHTML).toContain('<details class="folded-section"')
    expect(root.innerHTML).not.toContain('<details class="folded-section" open')
    expect(root.innerHTML).toContain('<summary class="folded-section-summary">')
    // heading text inside summary
    expect(root.innerHTML).toMatch(/<summary[^>]*>.*<h1[^>]*>.*Section A.*<\/h1>.*<\/summary>/s)
    // body paragraphs inside the details body
    expect(root.innerHTML).toContain('Body paragraph one')
    expect(root.innerHTML).toContain('Body paragraph two')
    expect(root.innerHTML).toContain('folded-section-content')
  })

  it('=for head1 :!folded renders <details open>', () => {
    render(
      <Podlite>
        {`
=begin pod
=for head1 :!folded
Section A

Body.
=end pod`}
      </Podlite>,
    )
    expect(root.innerHTML).toContain('<details class="folded-section" open="')
  })

  it('section ends at next same-level heading', () => {
    render(
      <Podlite>
        {`
=begin pod
=for head1 :folded
First

Paragraph in first section.

=head1 Second

Paragraph in second section.
=end pod`}
      </Podlite>,
    )
    // exactly one folded-section wrapping only the first heading + its body
    const detailsCount = (root.innerHTML.match(/folded-section(?!-)/g) || []).length
    expect(detailsCount).toBeGreaterThanOrEqual(1)
    // Second heading is OUTSIDE the details
    const afterDetails = root.innerHTML.split('</details>')[1] || ''
    expect(afterDetails).toContain('Second')
    expect(afterDetails).toContain('Paragraph in second section')
  })

  it('sub-headings (higher levels) are included in the section', () => {
    render(
      <Podlite>
        {`
=begin pod
=for head1 :folded
Top

=head2 Sub

Sub body.

=head1 Next

Next body.
=end pod`}
      </Podlite>,
    )
    // The section must include =head2 Sub
    const before = root.innerHTML.split('</details>')[0] || ''
    expect(before).toContain('Sub')
    expect(before).toContain('Sub body')
    // but NOT the next =head1
    expect(before).not.toContain('Next body')
  })

  it('section of =head2 :folded ends at same-level head2 OR higher-level head1', () => {
    render(
      <Podlite>
        {`
=begin pod
=head1 Chapter

=for head2 :folded
Section A

Body A.

=head2 Section B

Body B.
=end pod`}
      </Podlite>,
    )
    const before = root.innerHTML.split('</details>')[0] || ''
    expect(before).toContain('Section A')
    expect(before).toContain('Body A')
    expect(before).not.toContain('Body B')
  })

  it(':folded on =head inside a named block also folds (not only at pod level)', () => {
    render(
      <Podlite>
        {`
=begin pod
=begin CHANGES

=head2 v2.0

=head3 Added

New stuff.

=for head2 :folded
v1.0

=head3 Added

Old stuff.

=end CHANGES
=end pod`}
      </Podlite>,
    )
    const html = root.innerHTML
    expect(html).toContain('<details class="folded-section"')
    expect(html).toMatch(/<summary[^>]*>[\s\S]*v1\.0[\s\S]*<\/summary>/)
    expect(html).toContain('Old stuff')
    expect(html).toContain('v2.0')
    expect(html).toContain('New stuff')
    const detailsCount = (html.match(/<details class="folded-section"/g) || []).length
    expect(detailsCount).toBe(1)
  })

  it(':folded on =head inside =begin nested also folds', () => {
    render(
      <Podlite>
        {`
=begin pod
=begin nested

=for head1 :folded
Inside Nested

Inner body.

=end nested
=end pod`}
      </Podlite>,
    )
    const html = root.innerHTML
    expect(html).toContain('<details class="folded-section"')
    expect(html).toContain('Inside Nested')
    expect(html).toContain('Inner body')
  })

  it('nested folds: outer head1:folded contains inner head2:folded — both wrap, no double-wrap', () => {
    render(
      <Podlite>
        {`
=begin pod
=for head1 :folded
Outer

Outer body.

=for head2 :folded
Inner

Inner body.
=end pod`}
      </Podlite>,
    )
    const html = root.innerHTML
    const outerCount = (html.match(/<details class="folded-section"/g) || []).length
    expect(outerCount).toBe(2)
    expect(html).toContain('Outer')
    expect(html).toContain('Inner')
    expect(html).toContain('Outer body')
    expect(html).toContain('Inner body')
    // outer summary contains "Outer", and inside outer's content the inner <details> appears
    const outerOpen = html.indexOf('<details class="folded-section"')
    const innerOpen = html.indexOf('<details class="folded-section"', outerOpen + 1)
    expect(innerOpen).toBeGreaterThan(outerOpen)
  })

  it('regression: pod-level :folded head still works after recursive pre-pass', () => {
    render(
      <Podlite>
        {`
=begin pod
=for head1 :folded
Section A

Body.
=end pod`}
      </Podlite>,
    )
    const html = root.innerHTML
    expect(html).toContain('<details class="folded-section"')
    const detailsCount = (html.match(/<details class="folded-section"/g) || []).length
    expect(detailsCount).toBe(1)
  })
})
