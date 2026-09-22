import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Podlite } from '../src/index'

const page = (source: string): string => renderToStaticMarkup(<Podlite>{source}</Podlite>)
const tables = (html: string): number => (html.match(/class="toc"/g) || []).length

describe('a table of contents kept as a block', () => {
  it('renders one table for toc and for Toc', () => {
    const toc = page('=begin pod\n=toc head1\n=head1 Alpha\n=end pod\n')
    const legacy = page('=begin pod\n=Toc head1\n=head1 Alpha\n=end pod\n')
    expect([tables(toc), tables(legacy)]).toEqual([1, 1])
    expect(toc).not.toContain('not supported node')
    expect(legacy).toContain('href="#Alpha"')
  })

  it('gives the table its :id', () => {
    expect(page('=begin pod\n=for toc :id<contents>\nhead1\n=head1 Alpha\n=end pod\n')).toContain('id="contents"')
  })

  it('keeps a hidden caption hidden', () => {
    const out = page('=begin pod\n=for toc :masked :caption<SECRET>\nhead1\n=head1 Alpha\n=end pod\n')
    expect(tables(out)).toBe(1)
    expect(out).not.toContain('SECRET')
  })
})
