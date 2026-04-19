import { TestPodlite as Podlite } from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const root = { innerHTML: '' }
function render(jsx) {
  root.innerHTML = renderToStaticMarkup(jsx)
  return root.innerHTML
}

describe(':folded attribute on =head blocks', () => {
  it('=head1 without :folded renders plain <h1>', () => {
    render(
      <Podlite>
        {`
=begin pod
=head1 Title
=end pod`}
      </Podlite>,
    )
    expect(root.innerHTML).toContain('<h1')
    expect(root.innerHTML).not.toContain('<details')
  })

  it('=head1 :folded wraps heading in <details> (collapsed)', () => {
    render(
      <Podlite>
        {`
=begin pod
=for head1 :folded
Collapsed Title
=end pod`}
      </Podlite>,
    )
    expect(root.innerHTML).toContain('<details class="folded"')
    expect(root.innerHTML).not.toContain('open=')
    expect(root.innerHTML).toContain('<h1')
  })

  it('=head1 :!folded wraps heading in <details> open', () => {
    render(
      <Podlite>
        {`
=begin pod
=for head1 :!folded
Expanded Title
=end pod`}
      </Podlite>,
    )
    expect(root.innerHTML).toContain('<details class="folded" open="')
    expect(root.innerHTML).toContain('<h1')
  })

  it('=head2 :folded :caption renders summary with caption', () => {
    render(
      <Podlite>
        {`
=begin pod
=for head2 :folded :caption<Section A>
Heading text
=end pod`}
      </Podlite>,
    )
    expect(root.innerHTML).toContain('<details class="folded"')
    expect(root.innerHTML).toContain('<summary class="folded-summary">Section A</summary>')
    expect(root.innerHTML).toContain('<h2')
  })
})
