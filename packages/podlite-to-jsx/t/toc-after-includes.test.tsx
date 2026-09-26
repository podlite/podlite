import { Podlite } from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { getTextContentFromNode } from '@podlite/schema'

type Files = Record<string, string>

const readerOf = (files: Files, calls: string[] = []) => (path: string) => {
  calls.push(path)
  return files[path] ?? null
}

const render = (source: string, files: Files, props: Record<string, any> = {}): string =>
  renderToStaticMarkup(
    <Podlite includeReader={readerOf(files)} {...props}>
      {source}
    </Podlite>,
  )

const quiet = () => jest.spyOn(console, 'warn').mockImplementation(() => {})

// the table of contents part of the output, and the entries in it
const tocOf = (html: string): string => {
  const at = html.indexOf('<div class="toc">')
  return at === -1 ? '' : html.slice(at, html.indexOf('</ul></div>', at) + 11)
}
const entries = (html: string): string[] =>
  [...tocOf(html).matchAll(/<a[^>]*>([^<]*)<\/a>/g)].map(m => m[1].trim())
const hrefs = (html: string): string[] => [...tocOf(html).matchAll(/<a href="([^"]*)"/g)].map(m => m[1])

// the id an element carrying the given text is written with
const idAt = (html: string, text: string): string | undefined => {
  const body = html.replace(tocOf(html), '')
  const at = body.indexOf(`>${text}`)
  if (at === -1) return undefined
  const open = body.lastIndexOf('<', at)
  return body.slice(open, at).match(/id="([^"]*)"/)?.[1]
}

const part = { 'p.podlite': '=head1 Included\n\nText.\n\n=head2 Inner\n' }

describe('a table of contents over a document with includes', () => {
  it('lists the included headings with their addresses', () => {
    const html = render('=pod\n\n=toc head1, head2\n\n=head1 Own\n\n=include file:p.podlite\n', part)
    expect(entries(html)).toEqual(['Own', 'Included', 'Inner'])
    expect(hrefs(html)).toEqual(['#Own', '#Included', '#Inner'])
  })

  it('gives a link in the including file the address of an included block', () => {
    const html = render('=pod\n\n=para See L<the part|#Included>.\n\n=include file:p.podlite\n', part)
    expect(html).toContain('<a href="#Included">the part</a>')
  })

  it('does not list the directive, which is no longer there', () => {
    const html = render('=pod\n\n=toc include, head1\n\n=include file:p.podlite\n', part)
    expect(entries(html)).toEqual(['Included'])
    const all = render('=pod\n\n=toc *\n\n=include file:p.podlite\n', part)
    expect(entries(all).some(e => e.includes('file:'))).toBe(false)
    expect(entries(all)).toContain('Included')
  })

  it('selects a paragraph written without a marker', () => {
    const html = render('=pod\n\n=include file:p.podlite | para\n', part)
    expect(html).toContain('Text.')
    expect(html).not.toContain('Included')
  })

  it('lets the selection find a heading an include of the included file brought', () => {
    const files = { 'p.podlite': '=include file:q.podlite\n\n=para P text\n', 'q.podlite': '=head1 From Q\n' }
    const html = render('=pod\n\n=toc head1\n\n=include file:p.podlite | head1\n', files)
    expect(entries(html)).toEqual(['From Q'])
  })

  it('reads a nested include the selection does not take, and reports it when it fails', () => {
    const warn = quiet()
    const calls: string[] = []
    const files = { 'p.podlite': '=include file:absent.podlite\n\n=head1 P\n' }
    renderToStaticMarkup(
      <Podlite includeReader={readerOf(files, calls)}>{'=pod\n\n=include file:p.podlite | head1\n'}</Podlite>,
    )
    const said = warn.mock.calls.map(c => String(c[0]))
    warn.mockRestore()
    expect(calls).toContain('absent.podlite')
    expect(said.some(s => s.includes('include is not resolved: file:absent.podlite'))).toBe(true)
  })

  it('builds the table of an included file after that file takes its own include', () => {
    const files = { 'p.podlite': '=toc head1\n\n=head1 P\n\n=include file:q.podlite\n', 'q.podlite': '=head1 Q\n' }
    const html = render('=pod\n\n=head1 Main\n\n=include file:p.podlite\n', files)
    expect(entries(html)).toEqual(['P', 'Q'])
  })

  it('keeps the table of an included file to that file for now (a limit)', () => {
    const files = { 'p.podlite': '=toc head1\n\n=head1 P\n' }
    const html = render('=pod\n\n=head1 Main\n\n=include file:p.podlite\n', files)
    expect(entries(html)).toEqual(['P'])
  })

  it('gives different addresses to a heading repeated in the including and the included file', () => {
    const files = { 'p.podlite': '=head1 Same\n' }
    const html = render('=pod\n\n=toc head1\n\n=head1 Same\n\n=include file:p.podlite\n', files)
    const ids = [...html.replace(tocOf(html), '').matchAll(/<h1 id="([^"]*)">Same/g)].map(m => m[1])
    expect(new Set(ids).size).toBe(2)
  })

  it('reads each file once and does not read a failed include again while rendering', () => {
    const warn = quiet()
    const calls: string[] = []
    renderToStaticMarkup(
      <Podlite includeReader={readerOf(part, calls)}>
        {'=pod\n\n=include file:p.podlite\n\n=include file:absent.podlite\n'}
      </Podlite>,
    )
    warn.mockRestore()
    expect(calls).toEqual(['p.podlite', 'absent.podlite'])
  })

  it('hides an included heading the including file masks, in the table too', () => {
    const files = { 'p.podlite': '=head1 hunter2\n' }
    const html = render('=pod\n\n=toc head1\n\n=begin pod :masked\n\n=include file:p.podlite\n\n=end pod\n', files)
    expect(html).not.toContain('hunter2')
  })

  it('stops at a self include instead of looping', () => {
    const warn = quiet()
    const files = { 'loop.podlite': '=include file:loop.podlite\n\n=head1 L\n' }
    const html = render('=pod\n\n=include file:loop.podlite\n', files)
    warn.mockRestore()
    expect(html).toContain('>L')
  })

  it('groups a test with the included block it stands under, as in the assembled document', () => {
    const files = { 'rule.podlite': 'A rule.\n' }
    const test = `=begin test :id<t1> :caption('t1 caption')\n=begin fixture\n=head2 Overview\n=end fixture\n\n=begin expected\n=head2 Overview\n=end expected\n=end test`
    const html = render(`=begin pod\n=include file:rule.podlite\n\n${test}\n=end pod\n`, files)
    expect(html).toMatch(/<div class="test-group"><p>A rule\.\n<\/p><details class="test" id="t1"/)
  })

  it('renders the page when the reader throws, and reports the include', () => {
    const warn = quiet()
    const html = renderToStaticMarkup(
      <Podlite
        includeReader={() => {
          throw new Error('reader down')
        }}
      >
        {'=pod\n\n=para Before\n\n=include file:p.podlite\n\n=para After\n'}
      </Podlite>,
    )
    const said = warn.mock.calls.map(c => String(c[0]))
    warn.mockRestore()
    expect(html).toContain('Before')
    expect(html).toContain('After')
    expect(said.some(s => s.includes('include target cannot be read: p.podlite: reader down'))).toBe(true)
  })

  it('renders the page when a mask cannot be expanded, and reports the include', () => {
    const warn = quiet()
    const html = renderToStaticMarkup(
      <Podlite
        includeReader={readerOf(part)}
        expandPaths={() => {
          throw new Error('glob down')
        }}
      >
        {'=pod\n\n=para Before\n\n=include file:*.podlite\n\n=para After\n'}
      </Podlite>,
    )
    const said = warn.mock.calls.map(c => String(c[0]))
    warn.mockRestore()
    expect(html).toContain('After')
    expect(said.some(s => s.includes('include mask cannot be expanded: *.podlite: glob down'))).toBe(true)
  })

  it('reports each file of a mask it cannot read, and keeps the files it read', () => {
    const warn = quiet()
    const html = renderToStaticMarkup(
      <Podlite
        includeReader={(p: string) => {
          if (p === 'bad1.podlite') throw new Error('broken')
          return p === 'good.podlite' ? '=head1 Good\n' : null
        }}
        expandPaths={() => ['bad1.podlite', 'good.podlite', 'bad2.podlite']}
      >
        {'=pod\n\n=include file:*.podlite\n'}
      </Podlite>,
    )
    const said = warn.mock.calls.map(c => String(c[0]))
    warn.mockRestore()
    expect(html).toContain('Good')
    expect(said).toEqual([
      '[to-jsx] include target cannot be read: bad1.podlite: broken',
      '[to-jsx] include target cannot be read: bad2.podlite',
    ])
  })

  it('renders nothing for an include without a reader, as before', () => {
    const html = renderToStaticMarkup(<Podlite>{'=pod\n\n=para Before\n\n=include file:p.podlite\n'}</Podlite>)
    expect(html).toContain('Before')
    expect(html).not.toContain('Included')
  })
})

describe('the =set written before an include, in the assembled document', () => {
  it('reaches the next block when the include brings none, without a warning', () => {
    const warn = quiet()
    const html = render('=pod\n\n=set :id<chosen>\n=include file:p.podlite | hed1\n\n=head1 After\n', part)
    const said = warn.mock.calls.map(c => String(c[0]))
    warn.mockRestore()
    expect(idAt(html, 'After')).toBe('chosen')
    expect(said).toEqual([])
  })

  it('stops at an include that failed on the way, and says what it lost', () => {
    const warn = quiet()
    const html = render(
      '=pod\n\n=set :id<chosen>\n=include file:p.podlite | hed1\n\n=include file:absent.podlite\n\n=head1 After\n',
      part,
    )
    const said = warn.mock.calls.map(c => String(c[0]))
    warn.mockRestore()
    expect(idAt(html, 'After')).not.toBe('chosen')
    expect(said.some(s => /absent\.podlite; =set assignments not applied: id$/.test(s))).toBe(true)
  })

  it('warns when no block follows to the end of the list', () => {
    const warn = quiet()
    render('=pod\n\n=head1 Before\n\n=set :id<lost>\n=include file:p.podlite | hed1\n', part)
    const said = warn.mock.calls.map(c => String(c[0]))
    warn.mockRestore()
    expect(said).toContain('[to-jsx] =set before =include has no target block: id')
  })
})

describe('what a wrapper is told about an included block', () => {
  const collect = (source: string, files: Files, extra: Record<string, any> = {}) => {
    const seen: Array<[string, string[] | undefined]> = []
    const wrapElement = (node: any, children: any, ctx: any) => {
      if (node.type === 'block' && node.name === 'head') seen.push([String(getTextContentFromNode(node.content)).trim(), ctx?.includeStack])
      return children
    }
    renderToStaticMarkup(
      <Podlite includeReader={readerOf(files)} wrapElement={wrapElement} {...extra}>
        {source}
      </Podlite>,
    )
    return seen
  }

  it('gives each included heading the files it came through', () => {
    const files = {
      'a.podlite': '=head1 A\n',
      'b.podlite': '=head1 B\n\n=include file:c.podlite\n',
      'c.podlite': '=head1 C\n',
    }
    const seen = collect('=pod\n\n=head1 Own\n\n=include file:*.podlite | head1\n', files, {
      expandPaths: () => ['a.podlite', 'b.podlite'],
    })
    expect(seen).toEqual([
      ['Own', undefined],
      ['A', ['a.podlite', 'b.podlite']],
      ['B', ['a.podlite', 'b.podlite']],
      ['C', ['a.podlite', 'b.podlite', 'c.podlite']],
    ])
  })

  it('tells a group of tests nothing of its own', () => {
    const { groupTests } = require('../src/test-groups')
    const owner = { type: 'block', name: 'para', content: ['A rule.'] }
    const test = { type: 'block', name: 'test', content: [] }
    const carried: string[] = []
    groupTests([owner, test], (_from: any, to: any) => carried.push(to.name))
    expect(carried).not.toContain('_test_group')
  })

  it('does not change the tree it is given', () => {
    const { podlite } = require('podlite')
    const p = podlite({ importPlugins: true })
    const tree = p.toAst(p.parse('=pod\n\n=begin pod :masked\n\n=include file:p.podlite\n\n=end pod\n', { podMode: 1 }))
    const before = JSON.stringify(tree)
    renderToStaticMarkup(<Podlite includeReader={readerOf(part)} tree={{ interator: tree } as any} />)
    expect(JSON.stringify(tree)).toBe(before)
  })
})
