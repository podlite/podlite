import { TestPodlite as Podlite } from '../src/index'
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
