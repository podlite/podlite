import { TestPodlite as Podlite } from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const source = `=begin pod
=head1 Doc

=begin test :caption('a heading is recognised')
=begin resource :name<a.podlite>
=head1 Guide
=end resource

=begin fixture
=head2 Overview
=end fixture

=for assert
head2
=end test
=end pod
`

describe('the blocks of a test', () => {
  it('are not shown', () => {
    const html = renderToStaticMarkup(<Podlite>{source}</Podlite>)
    expect(html).toContain('Doc')
    expect(html).not.toContain('not supported node')
    expect(html).not.toContain('Overview')
    expect(html).not.toContain('Guide')
    expect(html).not.toContain('head2')
  })
})
