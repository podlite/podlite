import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TestPodlite } from '../src/index'

const render = (src: string) => renderToStaticMarkup(<TestPodlite>{src}</TestPodlite>)

// whitespace on either side of the bar is not significant (Specification 3930)
describe('the address of a link in JSX', () => {
  it('drops the whitespace around the bar', () => {
    expect(render('=para\nL<text| https://example.org >\n')).toContain('href="https://example.org"')
    expect(render('=para\nW<t| term >\n')).toContain('href="term"')
  })

  it('reads an address of spaces alone as an empty address', () => {
    expect(render('=para\nL<t| >\n')).toBe(render('=para\nL<t|>\n'))
  })
})
