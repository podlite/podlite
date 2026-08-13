import Podlite from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const render = (src: string) => renderToStaticMarkup(<Podlite>{`=begin pod\n\n${src}\n\n=end pod\n`}</Podlite>)

describe('link configuration attributes', () => {
  it('opens a link in a new context', () => {
    expect(render('L<API|https://api.example.com :new>')).toContain('target="_blank"')
  })

  it('writes the advisory title', () => {
    expect(render("L<API|https://api.example.com :title('Doc')>")).toContain('title="Doc"')
  })

  it('writes the language of the target', () => {
    expect(render('L<Guide|https://example.fr/guide :lang<fr>>')).toMatch(/hreflang="fr"/i)
  })

  it('writes a download name', () => {
    expect(render('L<SDK|https://example.com/sdk.tgz :download<sdk.tgz>>')).toContain('download="sdk.tgz"')
  })

  it('keeps a link without attributes as before', () => {
    expect(render('L<plain|https://example.com>')).toContain('<a href="https://example.com">plain</a>')
  })

  it('keeps the backlink class alongside the attributes', () => {
    const html = render("W<term|defn:glossary :title('See definition')>")
    expect(html).toContain('class="backlink"')
    expect(html).toContain('title="See definition"')
  })
})
