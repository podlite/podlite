import { Podlite } from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const page = (source: string, props = {}) => renderToStaticMarkup(<Podlite {...props}>{source}</Podlite>)
const headingIds = (out: string) => [...out.matchAll(/<h\d id="([^"]*)"/g)].map(m => m[1])

describe('a heading with hidden text on the page', () => {
  it('gets an address not made of its text, and a link follows it', () => {
    const out = page('=begin pod\n=for head1 :masked\nZorg Title\n\nSee L<jump|#Zorg Title>.\n=end pod\n')
    expect(headingIds(out)).toEqual(['masked-1'])
    expect(out).toContain('href="#masked-1"')
    expect(out).not.toContain('Zorg')
  })

  it('keeps the same address in draft', () => {
    const out = page('=begin pod\n=for head1 :masked\nZorg Title\n=end pod\n', { renderMode: 'draft' })
    expect(headingIds(out)).toEqual(['masked-1'])
  })

  it('gets no address made of its text when it comes in through an include', () => {
    const includeReader = (path: string) =>
      path === 'part.podlite' ? '=begin pod\n=for head1 :masked\nConfidential Phase\n\ntext\n=end pod\n' : null
    const out = page('=begin pod\n=include file:part.podlite\n=end pod\n', { includeReader })
    expect(out).toContain('<h1')
    expect(out).not.toContain('Confidential')
  })
})
