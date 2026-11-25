/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { Podlite } from '../src/index'
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const rendered = (source: string): string => {
  const host = document.createElement('div')
  const root = createRoot(host)
  act(() => root.render(<Podlite>{`=begin pod\n${source}\n=end pod\n`}</Podlite>))
  const out = host.innerHTML
  act(() => root.unmount())
  return out
}

describe('a =picture on the page', () => {
  it('shows the source of :src and both paragraphs of its body as the caption', () => {
    const out = rendered('=begin picture :src<orbit.svg>\ndata:Logo\n\nThe B<second> paragraph.\n=end picture')
    expect(out).toContain('<img src="orbit.svg">')
    expect(out).toMatch(
      /<div class="caption"><p[^>]*>data:Logo<\/p><p[^>]*>The <strong>second<\/strong> paragraph\.<\/p><\/div>/,
    )
  })

  it('shows no picture for an abbreviated block and keeps its text as the caption', () => {
    const out = rendered('=picture data:Logo')
    expect(out).not.toContain('<img')
    expect(out).toMatch(/<div class="caption">data:Logo\s*<\/div>/)
  })

  it('takes the source of an abbreviated block from =set', () => {
    const out = rendered('=set :src<astronaut.png>\n=picture The station.')
    expect(out).toContain('<img src="astronaut.png">')
    expect(out).toMatch(/<div class="caption">The station\.\s*<\/div>/)
  })
})
