import { podlitePluggable } from '../src/pluggableParser'

const parseInline = (src: string) => {
  const p = podlitePluggable()
  return p.toAst(p.parse(`=para\n${src}\n`, { podMode: 1 }))
}

const findCode = (node: any, name: string): any => {
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = findCode(n, name)
      if (found) return found
    }
    return null
  }
  if (!node || typeof node !== 'object') return null
  if (node.type === 'fcode' && node.name === name) return node
  if (node.content) return findCode(node.content, name)
  return null
}

const linkOf = (src: string) => findCode(parseInline(src), 'L')
const displayText = (link: any) => (link?.content || []).map((c: any) => c.value || '').join('')
const attr = (link: any, name: string) => (link?.config || []).find((c: any) => c.name === name)

const textOutsideCodes = (node: any, acc: string[] = []): string[] => {
  if (Array.isArray(node)) {
    node.forEach(n => textOutsideCodes(n, acc))
    return acc
  }
  if (!node || typeof node !== 'object') return acc
  if (node.type === 'fcode') return acc
  if (node.type === 'text') acc.push(node.value)
  if (node.content) textOutsideCodes(node.content, acc)
  return acc
}

describe('link configuration attributes', () => {
  it('reads a boolean attribute after the link specification', () => {
    const link = linkOf('L<API|https://api.example.com :new>')
    expect(link.meta).toBe('https://api.example.com')
    expect(attr(link, 'new')).toEqual({ name: 'new', value: true, type: 'boolean' })
  })

  it('reads a quoted string value', () => {
    const link = linkOf("L<API|https://api.example.com :title('Official documentation')>")
    expect(attr(link, 'title').value).toBe('Official documentation')
  })

  it('reads several attributes on one link', () => {
    const link = linkOf("L<API|https://api.example.com :new :title('Doc')>")
    expect(link.config.map((c: any) => c.name)).toEqual(['new', 'title'])
  })

  it('reads an angle-bracket value without losing the closing bracket', () => {
    const src = 'L<French|https://example.fr/guide :lang<fr>>'
    const link = linkOf(src)
    expect(link.meta).toBe('https://example.fr/guide')
    expect(attr(link, 'lang').value).toBe('fr')
    expect(textOutsideCodes(parseInline(src)).join('')).not.toContain('>')
  })

  it('reads a download name', () => {
    const link = linkOf('L<Download|https://example.com/sdk.tar.gz :download<sdk-v2.tar.gz>>')
    expect(attr(link, 'download').value).toBe('sdk-v2.tar.gz')
  })

  it('reads download without a value as a flag', () => {
    const link = linkOf('L<Download|https://example.com/sdk.tar.gz :download>')
    expect(attr(link, 'download')).toEqual({ name: 'download', value: true, type: 'boolean' })
  })

  it('reads a negated attribute as false', () => {
    const link = linkOf('L<Internal|file:local.html :!new>')
    expect(attr(link, 'new').value).toBe(false)
  })

  it('accepts attributes on a link without display text', () => {
    const link = linkOf('L<https://example.com :new>')
    expect(displayText(link)).toBe('https://example.com')
    expect(attr(link, 'new').value).toBe(true)
  })

  it('unquotes a link specification that holds a space', () => {
    const link = linkOf("L<'my document.txt' :download>")
    expect(displayText(link)).toBe('my document.txt')
    expect(attr(link, 'download').value).toBe(true)
  })

  it('treats a port as part of the link specification', () => {
    const link = linkOf('L<http://localhost:8080/api :new>')
    expect(displayText(link)).toBe('http://localhost:8080/api')
    expect(attr(link, 'new').value).toBe(true)
  })

  it('treats a colon path segment as part of the link specification', () => {
    const link = linkOf("L<https://api.example.com/users/:id :title('User profile')>")
    expect(displayText(link)).toBe('https://api.example.com/users/:id')
    expect(attr(link, 'title').value).toBe('User profile')
  })

  it('reads attributes on a backlink', () => {
    const backlink = findCode(parseInline("W<related term|defn:glossary :title('See definition')>"), 'W')
    expect(backlink.meta).toBe('defn:glossary')
    expect(attr(backlink, 'title').value).toBe('See definition')
  })

  it('reads attributes inside guillemet delimiters', () => {
    const link = findCode(parseInline('L«API|https://api.example.com :new»'), 'L')
    expect(link.meta).toBe('https://api.example.com')
    expect(attr(link, 'new').value).toBe(true)
  })

  it('leaves a link without attributes unchanged', () => {
    const link = linkOf('L<text|https://example.com>')
    expect(link.meta).toBe('https://example.com')
    expect(link.config).toBeUndefined()
  })

  it('keeps a formatting code in the display text', () => {
    const link = linkOf('L<B<bold>|https://example.com :new>')
    expect(link.meta).toBe('https://example.com')
    expect(findCode(link.content, 'B')).not.toBeNull()
  })
})
