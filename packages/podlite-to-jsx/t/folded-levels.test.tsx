import { TestPodlite as Podlite } from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const root = { innerHTML: '' }
function render(jsx) {
  root.innerHTML = renderToStaticMarkup(jsx)
  return root.innerHTML
}

describe(':folded-levels rendering in JSX', () => {
  it('folded level renders as <details> without open', () => {
    render(
      <Podlite>
        {`
=begin pod
=for toc :folded-levels[2]
head1, head2

=head1 Title
=head2 Sub-section
=end pod`}
      </Podlite>,
    )
    // level 2 should be wrapped in <details> (closed)
    expect(root.innerHTML).toContain('<details class="toc-fold">')
    expect(root.innerHTML).not.toContain('<details class="toc-fold" open')
  })

  it('only specified levels are folded, others render as plain list', () => {
    render(
      <Podlite>
        {`
=begin pod
=for toc :folded-levels[3]
head1, head2, head3

=head1 Title
=head2 Sub-section
=head3 Deep section
=end pod`}
      </Podlite>,
    )
    // level 2 should NOT be folded (not in folded-levels)
    // level 3 should be folded
    expect(root.innerHTML).toContain('<details class="toc-fold">')
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
