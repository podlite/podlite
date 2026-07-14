import { podlitePluggable } from '../src/pluggableParser'

const parseInline = (src: string) => {
  const p = podlitePluggable()
  return p.toAst(p.parse(`=para\n${src}\n`, { podMode: 1 }))
}

const findLink = (node: any): any => {
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = findLink(n)
      if (found) return found
    }
    return null
  }
  if (!node || typeof node !== 'object') return null
  if (node.type === 'fcode' && node.name === 'L') return node
  if (node.content) return findLink(node.content)
  return null
}

const linkOf = (src: string) => findLink(parseInline(src))
const displayText = (link: any) => (link?.content || []).map((c: any) => c.value || '').join('')

describe('link display text with guillemet quotes', () => {
  it('keeps the url separator when guillemets open the display text', () => {
    const link = linkOf('L<«Coming in Podlite 2.0»|https://podlite.org/x>')
    expect(displayText(link)).toBe('«Coming in Podlite 2.0»')
    expect(link.meta).toBe('https://podlite.org/x')
  })

  it('handles guillemets in the middle of the display text', () => {
    const link = linkOf('L<see «this»|url>')
    expect(displayText(link)).toBe('see «this»')
    expect(link.meta).toBe('url')
  })

  it('leaves plain display text unchanged', () => {
    const link = linkOf('L<plain|url>')
    expect(displayText(link)).toBe('plain')
    expect(link.meta).toBe('url')
  })

  it('keeps angle-bracket display text working', () => {
    const link = linkOf('L<a<b>c|url>')
    expect(displayText(link)).toBe('a<b>c')
    expect(link.meta).toBe('url')
  })
})
