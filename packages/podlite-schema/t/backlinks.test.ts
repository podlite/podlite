import { toHtml, toMarkdown } from '../src'

const parse = require('..').parse
const html = (src: string) => toHtml({}).run(src).toString()
const md = (src: string) => toMarkdown({}).run(src).toString()

const codes = (src: string) => {
  const found: Array<{ name: string; meta: unknown }> = []
  const walk = (n: any) => {
    if (Array.isArray(n)) return n.forEach(walk)
    if (!n || typeof n !== 'object') return
    if (n.type === 'fcode') found.push({ name: n.name, meta: n.meta })
    walk(n.content)
  }
  walk(parse(src, { podMode: 1 }))
  return found
}

describe('contextual backlinks', () => {
  it('parses with display text', () => {
    expect(codes('=for para\nsee W<term|defn:term>\n')).toEqual([{ name: 'W', meta: 'defn:term' }])
  })

  it('parses without display text', () => {
    expect(codes('=for para\nsee W<doc:perldata>\n')).toEqual([{ name: 'W', meta: null }])
  })

  it('accepts the same link schemes as a plain link', () => {
    const found = codes('=for para\nW<a|#anchor> W<b|https://example.com> W<c|file:other.podlite>\n')
    expect(found.map(f => f.meta)).toEqual(['#anchor', 'https://example.com', 'file:other.podlite'])
  })

  it('renders html distinguishable from a plain link', () => {
    const out = html('=for para\nW<term|defn:term> and L<plain|defn:term>\n')
    expect(out).toContain('<a href="defn:term" class="backlink">term</a>')
    expect(out).toContain('<a href="defn:term">plain</a>')
  })

  it('renders markdown as a link', () => {
    expect(md('=for para\nW<term|defn:term>\n')).toContain('[term](defn:term)')
  })

  it('leaves a plain link untouched', () => {
    expect(codes('=for para\nL<x|#a>\n')).toEqual([{ name: 'L', meta: '#a' }])
  })
})
