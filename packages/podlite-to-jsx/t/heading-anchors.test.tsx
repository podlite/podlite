import Podlite from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const render = (src: string) => renderToStaticMarkup(<Podlite>{src}</Podlite>)

const doc = `=begin pod

=head2 infix //

=head2 infix ^

=head2 Καλημέρα Κόσμε

=head2 Getting Started

L<by name|#Καλημέρα Κόσμε>, L<lowercased|#καλημέρα-κόσμε>, L<github style|#getting-started>, L<unknown|#nothing here>, L<empty|#>

=end pod
`

describe('heading anchors', () => {
  it('numbers headings that shape into the same anchor', () => {
    const html = render(doc)
    expect(html).toContain('<h2 id="infix">')
    expect(html).toContain('<h2 id="infix-2">')
  })

  it('keeps cyrillic letters in the anchor', () => {
    expect(render(doc)).toContain('<h2 id="Καλημέρα-Κόσμε">')
  })
})

describe('a link inside the document finds its heading', () => {
  it('matches the name as written', () => {
    expect(render(doc)).toContain('<a href="#Καλημέρα-Κόσμε">by name</a>')
  })

  it('matches without regard to case', () => {
    const html = render(doc)
    expect(html).toContain('<a href="#Καλημέρα-Κόσμε">lowercased</a>')
    expect(html).toContain('<a href="#Getting-Started">github style</a>')
  })

  it('leaves a link with no address when the target matches nothing', () => {
    expect(render(doc)).toContain('<a>unknown</a>')
    expect(render(doc)).not.toContain('#nothing-here')
  })

  it('leaves a bare anchor alone', () => {
    expect(render(doc)).toContain('<a href="#">empty</a>')
  })
})
