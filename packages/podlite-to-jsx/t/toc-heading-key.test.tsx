import { Podlite } from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { fingerprint, getFromTree, toHtml } from '@podlite/schema'
import { podlite } from 'podlite'

type Files = Record<string, string>

const render = (source: string, files: Files = {}, props: Record<string, any> = {}): string =>
  renderToStaticMarkup(
    <Podlite includeReader={(path: string) => files[path] ?? null} {...props}>
      {source}
    </Podlite>,
  )

// the table of contents part of the output, its addresses, and the ids headings got
const tocOf = (html: string): string => {
  const at = html.indexOf('<div class="toc">')
  return at === -1 ? '' : html.slice(at, html.indexOf('</ul></div>', at) + 11)
}
const hrefs = (html: string): string[] => [...tocOf(html).matchAll(/<a href="([^"]*)"/g)].map(m => m[1])
const headingIds = (html: string): string[] =>
  [...html.replace(tocOf(html), '').matchAll(/<h[1-6][^>]*\sid="([^"]*)"/g)].map(m => `#${m[1]}`)

// Specification.pod6: the =toc selector line, 2661-2675; headings, 1103-1113
describe('a table of contents entry leads to its own heading', () => {
  it('when two headings say the same thing', () => {
    const html = render('=pod\n\n=toc head1\n\n=head1 Intro\n\none\n\n=head1 Intro\n\ntwo\n')
    expect(hrefs(html)).toEqual(['#Intro', '#Intro-2'])
    expect(hrefs(html)).toEqual(headingIds(html))
  })

  it('when the including and the included file have a heading of one name', () => {
    const html = render('=pod\n\n=toc head1\n\n=head1 Same\n\n=include file:p.podlite\n', {
      'p.podlite': '=head1 Same\n\nIncluded.\n',
    })
    expect(hrefs(html)).toHaveLength(2)
    expect(hrefs(html)).toEqual(headingIds(html))
  })

  it('when two included files with different texts have a heading of one name', () => {
    const html = render('=pod\n\n=toc head1\n\n=include file:a.podlite\n\n=include file:b.podlite\n', {
      'a.podlite': '=head1 Same\n\n=comment a\n',
      'b.podlite': '=head1 Same\n\n=comment b\n',
    })
    expect(hrefs(html)).toEqual(['#Same', '#Same-2'])
  })

  it('when an included markdown file repeats a heading', () => {
    const html = render('=pod\n\n=toc head1\n\n=include file:p.md\n', { 'p.md': '# Same\n\none\n\n# Same\n\ntwo\n' })
    expect(hrefs(html)).toEqual(['#Same', '#Same-2'])
  })

  it('when markdown blocks with different bodies repeat a heading of the document', () => {
    const html = render(
      '=pod\n\n=toc head1\n\n=head1 Same\n\n=begin markdown\n# Same\n\none\n=end markdown\n\n=begin markdown\n# Same\n\ntwo\n=end markdown\n',
    )
    expect(hrefs(html)).toEqual(['#Same', '#Same-2', '#Same-3'])
    expect(hrefs(html)).toEqual(headingIds(html))
  })

  it('when the heading is selected from an included file with a heading of that name around it', () => {
    const html = render('=pod\n\n=toc head1\n\n=head1 Part\n\n=include file:p.podlite | head1\n', {
      'p.podlite': '=head1 Part\n\n=para skipped\n',
    })
    expect(hrefs(html)).toEqual(['#Part', '#Part-2'])
  })
})

describe('an entry for a heading the author named', () => {
  // =set applies to the first block an include brings, 2826-2828; ids differ, 3883-3886
  it('keeps the name when one file is included twice under =set :id', () => {
    const html = render(
      '=pod\n\n=toc head1\n\n=set :id<A>\n=include file:p.podlite\n\n=set :id<B>\n=include file:p.podlite\n',
      { 'p.podlite': '=head1 Same\n' },
    )
    expect(hrefs(html)).toEqual(['#A', '#B'])
  })
})

describe('the limit of the key', () => {
  it('leads both entries of one file included twice to the first copy, as before', () => {
    const html = render('=pod\n\n=toc head1\n\n=include file:p.podlite\n\n=include file:p.podlite\n', {
      'p.podlite': '=head1 Same\n',
    })
    expect(hrefs(html)).toEqual(['#Same', '#Same'])
  })
})

describe('a key an author happens to write as an id', () => {
  it('does not take an entry from its heading', () => {
    const part = '=head1 Same\n'
    const key = `h1.${fingerprint(part)}`
    const html = render(
      `=pod\n\n=toc head1\n\n=head1 Same\n\n=include file:p.podlite\n\n=for para :id<${key}>\nnamed\n\n=para L<to the named|#${key}>\n`,
      { 'p.podlite': part },
    )
    expect(hrefs(html)).toEqual(['#Same', '#Same-2'])
    // the author's link reaches the block named with that text, not a heading
    const authored = html.match(/<a href="([^"]*)">to the named<\/a>/)?.[1]
    const named = html.match(/<div id="([^"]*)"><p>named/)?.[1]
    expect(named).toBeDefined()
    expect(authored).toBe(`#${named}`)
  })
})

describe('the address of an entry for a hidden heading', () => {
  const doc = '=pod\n\n=toc head1\n\n=head1 Project G<Aurox>\n\nText.\n'

  it('holds no hidden text in the tree, before and after JSON', () => {
    const p = podlite({ importPlugins: true })
    const tree = p.toAst(p.parse(doc, { podMode: 1 }))
    const [head] = getFromTree(tree, 'head') as any[]
    const entries = (t: any) => (getFromTree(t, 'L') as any[]).filter(l => l.headingRef !== undefined)
    for (const t of [tree, JSON.parse(JSON.stringify(tree))]) {
      // the entry is kept twice, as the item's node and in its content
      expect(entries(t).length).toBeGreaterThan(0)
      for (const link of entries(t)) {
        expect(link.headingRef).toBe(head.headingKey)
        expect(`${link.meta} ${link.headingRef}`).not.toContain('Aurox')
      }
    }
    expect(String(toHtml({}).run(JSON.parse(JSON.stringify(tree))))).toContain('href="#masked-1"')
  })

  it('gives the link preview callback no hidden text', () => {
    const asked: string[] = []
    const html = render(
      doc,
      {},
      {
        linkPreview: (target: string) => {
          asked.push(target)
          return null
        },
      },
    )
    expect(hrefs(html)).toEqual(['#masked-1'])
    expect(asked.length).toBeGreaterThan(0)
    expect(asked.join(' ')).not.toContain('Aurox')
  })
})

describe('a tree sent through JSON', () => {
  it('keeps every entry on its own heading', () => {
    const p = podlite({ importPlugins: true })
    const tree = p.toAst(p.parse('=pod\n\n=toc head1\n\n=head1 Intro\n\n=head1 Intro\n', { podMode: 1 }))
    const html = String(toHtml({}).run(JSON.parse(JSON.stringify(tree))))
    expect([...html.matchAll(/<li class="toc-item"><p><a href="([^"]*)"/g)].map(m => m[1])).toEqual([
      '#Intro',
      '#Intro-2',
    ])
  })
})
