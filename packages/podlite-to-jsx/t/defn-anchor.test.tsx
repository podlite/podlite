// node ids are random, and an id checked to be absent could turn up inside one
jest.mock('nanoid', () => {
  let next = 0
  return { nanoid: () => `id-${next++}` }
})

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { indexAnchors, podlitePluggable, toFragment, toHtml } from '@podlite/schema'
import { Podlite } from '../src/index'

type Ctx = Record<string, unknown>
type Rule = (node: { content: unknown }, ctx: Ctx, it: (content: unknown, ctx: Ctx) => unknown) => unknown

const render = (src: string, root?: Rule, includeReader?: (path: string) => string | null) =>
  renderToStaticMarkup(
    <Podlite plugins={root ? () => ({ root: () => root }) : undefined} includeReader={includeReader}>
      {src}
    </Podlite>,
  )
const withoutIndex: Rule = (node, ctx, it) => it(node.content, { ...ctx, __anchors: undefined })
const withShape: Rule = (node, ctx, it) =>
  it(node.content, {
    ...ctx,
    __anchors: Object.assign({}, ctx.__anchors, { shape: (v: string) => 'custom-' + toFragment(v) }),
  })

// each term with the id on its own <dt>, in order
const terms = (html: string) => [...html.matchAll(/<dt(?: id="([^"]*)")?>(.*?)<\/dt>/g)].map(m => [m[2], m[1]])
const count = (html: string, id: string) => html.split(`id="${id}"`).length - 1
const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map(m => m[1])
const htmlOf = (src: string) => {
  const p = podlitePluggable()
  return String(p.toHtml(p.toAst(p.parse(src))))
}
const dtIds = (html: string) => [...html.matchAll(/<dt id="([^"]*)"/g)].map(m => m[1])

const one = '=for defn :id<t>\nTERM\nBody.\n'
const delimited = '=begin defn :id<t>\nTERM\nBody.\n\nMore.\n=end defn\n'
const group = '=for defn :id<a>\nA\nOne.\n=defn B\nTwo.\n=for defn :id<c>\nC\nThree.\n'
const toc =
  '=begin pod\n=toc defn\n\n=for defn :id<v1.2>\nONE\nFirst.\n\n=for defn :id<u>\nTWO\nSecond.\n\nSee L<#v1.2>.\n=end pod\n'
const same = '=for defn :id<t>\nA\nOne.\n=for defn :id<t>\nB\nTwo.\n'

describe('the term of a definition carries its :id in JSX', () => {
  it('puts the id on the <dt> of its term', () => {
    const html = render(one)
    expect(terms(html)).toEqual([['TERM', 't']])
    expect(count(html, 't')).toBe(1)
  })

  it('puts it once, on the term, when the body has two paragraphs', () => {
    const html = render(delimited)
    expect(terms(html)).toEqual([['TERM', 't']])
    expect(count(html, 't')).toBe(1)
    expect(html).not.toMatch(/<d[dl] id=/)
  })

  it('gives each term of one list its own id or none', () => {
    const html = render(group)
    expect(html.match(/<dl/g)).toHaveLength(1)
    expect(terms(html)).toEqual([
      ['A', 'a'],
      ['B', undefined],
      ['C', 'c'],
    ])
    expect(html).not.toMatch(/<d[dl] id=/)
  })

  describe('a link from the contents or the text finds its term', () => {
    it.each([
      ['with the index of anchors', undefined],
      ['without it', withoutIndex],
    ])('%s', (_, root) => {
      const html = render(toc, root)
      expect(terms(html)).toEqual([
        ['ONE', 'v12'],
        ['TWO', 'u'],
      ])
      expect(hrefs(html)).toEqual(['#v12', '#u', '#v12'])
    })

    it('with an anchor shape of its own', () => {
      const html = render(toc, withShape)
      expect(terms(html)).toEqual([
        ['ONE', 'custom-v12'],
        ['TWO', 'custom-u'],
      ])
      expect(hrefs(html)).toEqual(['#custom-v12', '#custom-u', '#custom-v12'])
    })

    it('with the same shape in HTML', () => {
      const p = podlitePluggable()
      const tree = p.toAst(p.parse(toc))
      const shape = (v: string) => 'custom-' + toFragment(v)
      const html = String(toHtml({ context: { __anchors: { ...indexAnchors(tree), shape } } }).run(tree, null))
      const jsx = render(toc, withShape)
      expect(dtIds(html)).toEqual(['custom-v12', 'custom-u'])
      expect(dtIds(jsx)).toEqual(dtIds(html))
      expect(hrefs(html)).toEqual(['#custom-v12'])
      expect(hrefs(jsx).slice(-1)).toEqual(hrefs(html))
    })
  })

  it.each([
    ['a quoted value with a space', '=for defn :id("a b")\nTERM\nBody.\n', 'a-b'],
    ['a list, by its first value', '=for defn :id<a b>\nTERM\nBody.\n', 'a'],
    ['letters that are not latin', '=for defn :id<Καλημέρα>\nTERM\nBody.\n', 'Καλημέρα'],
  ])('shapes %s as HTML does', (_, src, id) => {
    expect(terms(render(src))).toEqual([['TERM', id]])
  })

  it('writes one id twice when two definitions share it, as HTML does', () => {
    const html = render(same)
    expect(terms(html)).toEqual([
      ['A', 't'],
      ['B', 't'],
    ])
    expect(count(html, 't')).toBe(2)
  })

  it('gives a definition brought in by =include its id', () => {
    const source = '=begin pod\n=for defn :id<t>\nTERM\nBody.\n=end pod\n'
    const reader = (path: string) => (path === 'terms.podlite' ? source : null)
    const html = render('=begin pod\n=include file:terms.podlite | defn\n=end pod\n', undefined, reader)
    expect(terms(html)).toEqual([['TERM', 't']])
    expect(dtIds(htmlOf(source))).toEqual(['t'])
  })

  it.each([
    ['one definition', one],
    ['a body of two paragraphs', delimited],
    ['a list', group],
    ['a contents', toc],
    ['a shared id', same],
  ])('writes the same ids on terms as HTML for %s', (_, src) => {
    expect(dtIds(render(src))).toEqual(dtIds(htmlOf(src)))
  })
})

describe('a definition without :id keeps its term bare', () => {
  it.each([
    ['one definition', '=defn TERM\nBody.\n'],
    ['two in a row', '=defn A\nOne.\n=defn B\nTwo.\n'],
    ['an id that shapes to nothing', '=for defn :id<...>\nTERM\nBody.\n'],
    ['an :id written in the term', '=defn :id<t> TERM\nBody.\n'],
  ])('%s', (_, src) => {
    const html = render(src)
    expect(html).not.toMatch(/ id=/)
  })

  it('leaves the id of the container where it is', () => {
    const html = render('=begin pod :id<p>\n=defn TERM\nBody.\n=end pod\n')
    expect([...html.matchAll(/ id="([^"]*)"/g)].map(m => m[1])).toEqual(['p'])
  })

  it('keeps the term text as written when :id stands on the term line', () => {
    expect(terms(render('=defn :id<t> TERM\nBody.\n'))).toEqual([[':id&lt;t&gt; TERM', undefined]])
  })
})
