import { Podlite } from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

type Files = Record<string, string>

const run = (source: string, files: Files) => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const html = renderToStaticMarkup(<Podlite includeReader={(path: string) => files[path] ?? null}>{source}</Podlite>)
  const said = warn.mock.calls.map(c => String(c[0]))
  warn.mockRestore()
  return { html: html.replace(/\n/g, ''), said }
}

// the id an element carrying the given text is written with
const idAt = (html: string, text: string): string | undefined => {
  const at = html.indexOf(`>${text}`)
  if (at === -1) return undefined
  return html.slice(html.lastIndexOf('<div', at), at).match(/id="([^"]*)"/)?.[1]
}

describe('=config of the including file in included blocks', () => {
  it('reaches the blocks an include places after it', () => {
    const r = run('=config para :id<book>\n\n=include file:ch.podlite\n', { 'ch.podlite': '=para Included\n' })
    expect(idAt(r.html, '<p>Included')).toBe('book')
  })

  it('yields to a =config of the included file, option by option', () => {
    const r = run('=config code :allow<B>\n=config para :id<book>\n\n=include file:ch.podlite\n', {
      'ch.podlite': '=config code :lang<raku>\n=config para :id<own>\n\n=para In\n\n=begin code\nB<x>\n=end code\n',
    })
    expect(idAt(r.html, '<p>In')).toBe('own')
    expect(r.html).toContain('<strong>x</strong>')
  })

  it('passes through a file to the file it includes, the nearer file first', () => {
    const r = run('=config para :id<book>\n\n=include file:part.podlite\n', {
      'part.podlite': '=config para :id<part>\n\n=include file:leaf.podlite\n',
      'leaf.podlite': '=para Leaf\n',
    })
    expect(idAt(r.html, '<p>Leaf')).toBe('part')
  })

  it('does not come from an included file to the blocks after the include', () => {
    const r = run('=include file:ch.podlite\n\n=para After\n', { 'ch.podlite': '=config para :id<own>\n\n=para In\n' })
    expect(idAt(r.html, '<p>In')).toBe('own')
    expect(idAt(r.html, '<p>After')).not.toBe('own')
  })

  it('is not read by the selector of the include', () => {
    const files = { 'ch.podlite': '=for para :tag<own>\nOwn\n\n=para Plain\n' }
    const r = run('=config para :tag<own>\n\n=include file:ch.podlite | para[ :tag<own> ]\n', files)
    expect(r.html).toContain('Own')
    expect(r.html).not.toContain('Plain')
  })

  it('reaches a selector that reads a file with what that file includes', () => {
    const r = run('=config head1 :id<book>\n\n=include file:part.podlite | head1\n', {
      'part.podlite': '=include file:leaf.podlite\n',
      'leaf.podlite': '=head1 Leaf\n',
    })
    expect(r.html).toContain('<h1 id="book">Leaf')
  })

  it('folds a heading of the included file', () => {
    const r = run('=config head1 :folded\n\n=head1 Book\n\n=include file:ch.podlite\n', {
      'ch.podlite': '=head1 Chapter\n\n=para Text\n',
    })
    expect(r.html.match(/<details/g)?.length).toBe(2)
  })

  it('opens an included code block to the markup codes it allows', () => {
    const r = run('=config code :allow<B>\n\n=include file:ch.podlite\n', {
      'ch.podlite': '=begin code\nB<x>\n=end code\n',
    })
    expect(r.html).toContain('<strong>x</strong>')
  })

  it('reaches a file included twice with the settings at each directive', () => {
    const r = run(
      '=config para :id<a>\n\n=include file:ch.podlite\n\n=config para :id<b>\n\n=include file:ch.podlite\n',
      { 'ch.podlite': '=para Child\n' },
    )
    expect([...r.html.matchAll(/id="([ab])"/g)].map(m => m[1])).toEqual(['a', 'b'])
  })

  it('is read by a table of contents of the including file', () => {
    const r = run('=toc head1[ :tag<a> ]\n\n=config head1 :tag<a>\n\n=head1 Book\n\n=include file:ch.podlite\n', {
      'ch.podlite': '=head1 Chapter\n',
    })
    const toc = r.html.slice(r.html.indexOf('class="toc"'), r.html.indexOf('</ul>'))
    expect([...toc.matchAll(/<a[^>]*>([^<]*)<\/a>/g)].map(m => m[1])).toEqual(['Book', 'Chapter'])
  })
})

describe('a =set before an include, under =config of the including file', () => {
  const book = '=config para :tag<book>\n\n=set :id<chosen>\n=include file:part.podlite | para\n'

  it('reaches the found block when an include after it fails', () => {
    const r = run(book, { 'part.podlite': '=para First\n\n=include file:absent.podlite\n' })
    expect(idAt(r.html, '<p>First')).toBe('chosen')
    expect(r.said).toEqual(['[to-jsx] include is not resolved: file:absent.podlite'])
  })

  it('is lost, and named, when an include before the found block fails', () => {
    const r = run(book, { 'part.podlite': '=include file:absent.podlite\n\n=para First\n' })
    expect(idAt(r.html, '<p>First')).not.toBe('chosen')
    expect(r.said).toEqual(['[to-jsx] include is not resolved: file:absent.podlite; =set assignments not applied: id'])
  })
})
