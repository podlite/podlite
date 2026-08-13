import { toHtml, toMarkdown } from '../src'

const html = (src: string) => toHtml({}).run(`=para\n${src}\n`).toString()
const markdown = (src: string) => toMarkdown({}).run(`=para\n${src}\n`).toString()

describe('link configuration attributes in html', () => {
  it('opens a link in a new context', () => {
    expect(html('L<API|https://api.example.com :new>')).toContain('target="_blank"')
  })

  it('writes the advisory title', () => {
    expect(html("L<API|https://api.example.com :title('Doc')>")).toContain('title="Doc"')
  })

  it('writes the language of the target', () => {
    expect(html('L<Guide|https://example.fr/guide :lang<fr>>')).toContain('hreflang="fr"')
  })

  it('writes a download name', () => {
    expect(html('L<SDK|https://example.com/sdk.tgz :download<sdk.tgz>>')).toContain('download="sdk.tgz"')
  })

  it('writes download without a value as a bare attribute', () => {
    expect(html('L<SDK|https://example.com/sdk.tgz :download>')).toContain(
      '<a href="https://example.com/sdk.tgz" download>',
    )
  })

  it('drops an attribute turned off', () => {
    expect(html('L<Internal|file:local.html :!new>')).not.toContain('target=')
  })

  it('escapes a double quote inside the title', () => {
    expect(html('L<API|https://api.example.com :title(\'say "hi"\')>')).toContain('title="say &quot;hi&quot;"')
  })

  it('ignores an attribute it has no place for', () => {
    expect(html('L<API|https://api.example.com :unknown<x>>')).toContain('<a href="https://api.example.com">')
  })

  it('keeps a link without attributes as before', () => {
    expect(html('L<plain|https://example.com>')).toContain('<a href="https://example.com">plain</a>')
  })

  it('keeps the backlink class alongside the attributes', () => {
    const out = html("W<term|defn:glossary :title('See definition')>")
    expect(out).toContain('class="backlink"')
    expect(out).toContain('title="See definition"')
  })
})

describe('link configuration attributes in markdown', () => {
  it('carries the title into the link', () => {
    expect(markdown("L<API|https://api.example.com :title('Doc')>")).toContain('[API](https://api.example.com "Doc")')
  })

  it('leaves a link without a title untouched', () => {
    expect(markdown('L<API|https://api.example.com :new>')).toContain('[API](https://api.example.com)')
  })
})
