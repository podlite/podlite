import { parse } from '../src'

const links = (src: string) => {
  const found: Array<{ name: string; meta: unknown }> = []
  const walk = (n: any) => {
    if (Array.isArray(n)) return n.forEach(walk)
    if (!n || typeof n !== 'object') return
    if (n.type === 'fcode' && (n.name === 'L' || n.name === 'W')) found.push({ name: n.name, meta: n.meta })
    walk(n.content)
  }
  walk(parse(src, { podMode: 1 }))
  return found
}

describe('link text with formatting codes', () => {
  it('keeps the target when the text is italic', () => {
    expect(links('=for para\nsee L<I<this page>|https://example.org/>\n')).toEqual([
      { name: 'L', meta: 'https://example.org/' },
    ])
  })

  it('keeps the target when the text mixes codes', () => {
    expect(links('=for para\nsee L<B<bold> and I<it>|/doc/page>\n')).toEqual([{ name: 'L', meta: '/doc/page' }])
  })

  it('keeps the target when the text is inline code', () => {
    expect(links('=for para\nsee L<C<code>|/doc/page>\n')).toEqual([{ name: 'L', meta: '/doc/page' }])
  })

  it('applies to backlinks as well', () => {
    expect(links('=for para\nsee W<I<term>|defn:term>\n')).toEqual([{ name: 'W', meta: 'defn:term' }])
  })

  it('leaves a link without display text alone', () => {
    expect(links('=for para\nsee L<https://example.org/x#anchor>\n')).toEqual([{ name: 'L', meta: null }])
  })

  it('parses the formatted text into nodes', () => {
    const tree = parse('=for para\nsee L<I<this page>|https://example.org/>\n', { podMode: 1 })
    const names: string[] = []
    const walk = (n: any) => {
      if (Array.isArray(n)) return n.forEach(walk)
      if (!n || typeof n !== 'object') return
      if (n.type === 'fcode') names.push(n.name)
      walk(n.content)
    }
    walk(tree)
    expect(names).toEqual(['L', 'I'])
  })
})
