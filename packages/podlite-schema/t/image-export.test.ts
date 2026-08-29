import { podlite as podliteCore } from 'podlite'

const doc = (src: string) => `=begin pod\n\n${src}\n\n=end pod\n`
const p = () => podliteCore({ importPlugins: true })

const html = (src: string): string => {
  const podlite = p()
  return String(podlite.toHtml(podlite.toAst(podlite.parse(doc(src))))).replace(/\n/g, '')
}

const markdown = (src: string): string => {
  const podlite = p()
  return String(podlite.toMarkdown(podlite.toAst(podlite.parse(doc(src))))).replace(/\n+/g, ' ')
}

const img = (out: string) => (out.match(/<img[^>]*>/) || [''])[0]

describe('an image carried into an export', () => {
  it('leaves out the alternative text the author never wrote', () => {
    expect(img(html('=Image ok.png'))).toBe('<img src="ok.png"/>')
    expect(html('=Image ok.png')).not.toContain('undefined')
  })

  it('writes the alternative text the author did write', () => {
    expect(img(html('=Image some text ok.png'))).toContain('alt="some text"')
  })

  it('quotes the address like every other attribute value', () => {
    expect(img(html('=Image a"b.png'))).toContain('src="a&quot;b.png"')
    expect(img(html('=Image a"b.png'))).not.toContain('src="a"b')
  })

  it('quotes the alternative text too', () => {
    expect(img(html('=Image a"b ok.png'))).toContain('alt="a&quot;b"')
  })

  it('brackets an address markdown would otherwise cut short', () => {
    expect(markdown('=Image a)b.png')).toContain('](<a)b.png>)')
  })

  it('leaves a plain address alone in markdown', () => {
    expect(markdown('=Image ok.png')).toContain('](ok.png)')
  })
})

describe('an image whose alternative text was written without a value', () => {
  it('says nothing rather than reading the word "true" aloud', () => {
    expect(img(html('=for Image :alt\nok.png'))).toBe('<img src="ok.png"/>')
    expect(img(html('=for Image :!alt\nok.png'))).toBe('<img src="ok.png"/>')
  })

  it('says nothing in markdown either', () => {
    expect(markdown('=for Image :alt\nok.png')).toContain('![](ok.png)')
    expect(markdown('=for Image :!alt\nok.png')).toContain('![](ok.png)')
  })
})

describe('an image the markdown parser built', () => {
  const md = (src: string) => `=begin markdown\n${src}\n=end markdown\n`

  it('keeps an alternative text the author wrote as empty', () => {
    expect(img(html(md('![](ok.png)')))).toContain('alt=""')
  })

  it('quotes the address there as well', () => {
    expect(img(html(md('![](a"b.png)')))).toContain('src="a&quot;b.png"')
  })
})
