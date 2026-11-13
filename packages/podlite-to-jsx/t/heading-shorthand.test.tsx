import { Podlite as LivePodlite, TestPodlite as Podlite } from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const render = (body: string) => renderToStaticMarkup(<Podlite>{`=begin pod\n${body}\n=end pod\n`}</Podlite>)

describe('a heading whose first word is a single #', () => {
  it('is drawn with its number and without the #', () => {
    expect(render('=head2 # Shorthand')).toContain('<h2 id="id"><span class="head-number">1.</span> Shorthand\n</h2>')
  })

  it('keeps a # that is not a whole first word', () => {
    expect(render('=head2 C# tips')).toContain('<h2 id="id">C# tips\n</h2>')
  })
})

describe('a lone # at the start of the text of an item or a definition', () => {
  it('numbers an item whose text starts after a blank line', () => {
    expect(render('=begin item\n\n# first\n=end item')).toContain('<ol')
  })

  it('leaves the term of a numbered definition without the #', () => {
    const html = render('=defn # TERM\nBody.')
    expect(html).toContain('<dt>TERM</dt>')
    expect(html).not.toContain('#')
  })

  it('lists a numbered definition in a table of contents by its own id', () => {
    const html = renderToStaticMarkup(
      <LivePodlite>{'=begin pod\n=toc defn[ :numbered ]\n\n=for defn :id<t>\n# TERM\nBody.\n=end pod\n'}</LivePodlite>,
    )
    expect(html).toContain('href="#t"')
  })
})
