import { Podlite } from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const files: Record<string, string> = {
  'p.podlite': '=pod\n\n=head1 Included\n\nText.\n',
  'nested-first.podlite': '\n=comment first a note\n\n=include file:inner.podlite | head1\n\n=head1 Outer part\n',
  'nested-later.podlite': '=head1 Outer part\n\n=include file:inner.podlite | head1\n',
  'inner.podlite': '=head1 Inner part\n',
  'own-set.podlite': '=set :id<inner>\n=include file:inner.podlite | head1\n',
}
const includeReader = (path: string) => files[path] ?? null

const render = (source: string): string =>
  renderToStaticMarkup(<Podlite includeReader={includeReader}>{source}</Podlite>)

// the id an element carrying the given text is written with
const idAt = (html: string, text: string): string | undefined => {
  const at = html.indexOf(text)
  if (at === -1) return undefined
  const open = html.lastIndexOf('<', html.lastIndexOf('<h', at))
  const tag = html.slice(open, html.indexOf('>', open))
  return tag.match(/id="([^"]*)"/)?.[1]
}

describe('=set before =include in to-jsx', () => {
  it('gives the first included block the assignment', () => {
    const html = render('=pod\n\n=set :id<chosen>\n=include file:p.podlite | head1\n\n=head1 After\n')
    expect(idAt(html, 'Included')).toBe('chosen')
    expect(idAt(html, 'After')).not.toBe('chosen')
  })

  it('gives it to the first block of an include the included file starts with', () => {
    const html = render('=pod\n\n=set :id<deep>\n=include file:nested-first.podlite\n')
    expect(idAt(html, 'Inner part')).toBe('deep')
    expect(idAt(html, 'Outer part')).not.toBe('deep')
  })

  it('keeps it on a block written before a nested include', () => {
    const html = render('=pod\n\n=set :id<deep>\n=include file:nested-later.podlite\n')
    expect(idAt(html, 'Outer part')).toBe('deep')
    expect(idAt(html, 'Inner part')).not.toBe('deep')
  })

  it('lets the including file win over a =set of the included one before its include', () => {
    const html = render('=pod\n\n=set :id<outer>\n=include file:own-set.podlite\n')
    expect(idAt(html, 'Inner part')).toBe('outer')
  })

  it('does not pass it on when the include fails, and says so', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const html = render('=pod\n\n=set :id<x>\n=include file:absent.podlite\n\n=head1 After\n')
    const said = warn.mock.calls.map(c => String(c[0]))
    warn.mockRestore()
    expect(idAt(html, 'After')).not.toBe('x')
    expect(said.some(s => /not resolved: file:absent\.podlite; =set assignments not applied: id/.test(s))).toBe(true)
  })

  it('passes it on to the next block when the include brings none', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const html = render('=pod\n\n=set :id<chosen>\n=include file:p.podlite | hed1\n\n=head1 After\n')
    warn.mockRestore()
    expect(idAt(html, 'After')).toBe('chosen')
  })
})
