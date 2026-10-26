import Podlite from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const render = (src: string) => renderToStaticMarkup(<Podlite>{`=begin pod\n\n${src}\n\n=end pod\n`}</Podlite>)
const links = (html: string) => (html.match(/<a\b/g) || []).length

// HTML has no link within a link: a link written inside the text of another gives only its text
describe('a link inside the text of a link', () => {
  it.each([
    ['L<the L<inner|/inner> part|/outer>', '/outer'],
    ['L<the W<inner|defn:inner> part|/outer>', '/outer'],
    ['W<the L<inner|/inner> part|defn:outer>', 'defn:outer'],
    ['W<the W<inner|defn:inner> part|defn:outer>', 'defn:outer'],
  ])('%s gives one link, to the outer address, with the inner text', (src, outer) => {
    const html = render(src)
    expect(links(html)).toBe(1)
    expect(html).toContain(`href="${outer}"`)
    expect(html).toMatch(/>the inner part<\/a>/)
  })

  it('keeps links side by side as they were', () => {
    const html = render('L<one|/one> and W<two|defn:two>')
    expect(links(html)).toBe(2)
  })

  it('keeps the formatting of the inner text', () => {
    expect(render('L<the L<B<inner>|/inner> part|/outer>')).toContain(
      '<a href="/outer">the <strong>inner</strong> part</a>',
    )
  })
})
