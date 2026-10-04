import { Podlite } from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

type Mode = 'production' | 'draft'

const page = (body: string, mode: Mode = 'production') =>
  renderToStaticMarkup(<Podlite renderMode={mode}>{`=begin pod\n\n${body}\n\n=end pod\n`}</Podlite>)

const count = (html: string, tag: string) => (html.match(new RegExp(`<${tag}[ >]`, 'g')) || []).length

describe('a paragraph and code written without a marker render with their settings', () => {
  it('a nested paragraph and code are nested', () => {
    const html = page('=config para :nested(1)\n=config code :nested(1)\n\nPlain.\n\n    my $x = 1;')
    expect(count(html, 'blockquote')).toBe(2)
  })

  it('code written with or without a marker is nested alike', () => {
    const body = '=config code :nested(1)\n\n    x;\n\n=begin code\ny;\n=end code'
    expect(count(page(body), 'blockquote')).toBe(2)
  })

  it('the paragraph of a definition is nested', () => {
    const html = page('=config para :nested(1)\n\n=defn Term\nDefinition.')
    expect(html).toMatch(/<dd[^>]*><blockquote[^>]*>Definition\./)
  })

  it('an explicit para is nested once, not by its text again', () => {
    expect(count(page('=config para :nested(1)\n\n=para Explicit'), 'blockquote')).toBe(1)
  })

  it('a masked paragraph is hidden in production and shown in draft', () => {
    const body = '=config para :masked\n\nSecretword.'
    expect(page(body)).not.toContain('Secretword')
    expect(page(body, 'draft')).toContain('Secretword')
  })

  it('a document without nesting has no nesting', () => {
    expect(count(page('Plain.\n\n    my $x = 1;\n\n=defn Term\nDefinition.'), 'blockquote')).toBe(0)
  })
})
