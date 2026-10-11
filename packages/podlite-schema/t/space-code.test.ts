import { toHtml, toMarkdown } from '../src'

const asHtml = (pod: string): string => String(toHtml({}).run(pod).toString())
const asMarkdown = (pod: string): string => String(toMarkdown({}).run(pod).toString())

describe('the space-preserving code', () => {
  it('keeps its spaces in markdown', () => {
    expect(asMarkdown('=pod\nS<a   b>\n')).toContain('a&nbsp;&nbsp;&nbsp;b')
  })

  it('keeps its spaces in html', () => {
    expect(asHtml('=pod\nS<a   b>\n')).toContain('a&nbsp;&nbsp;&nbsp;b')
  })

  it('exports an empty one', () => {
    expect(() => asMarkdown('=pod\nS<>\n')).not.toThrow()
    expect(() => asHtml('=pod\nS<>\n')).not.toThrow()
  })

  it('writes a line break in html as <br>', () => {
    const html = asHtml('=pod\nS<one\ntwo>\n')
    expect(html).toContain('one<br>two')
    expect(html).not.toContain('</br>')
  })

  it('escapes its text in html', () => {
    const html = asHtml('=pod\nS« a < b & c »\n')
    expect(html).toContain('a&nbsp;&lt;&nbsp;b&nbsp;&amp;&nbsp;c')
  })

  it('escapes its text in markdown', () => {
    expect(asMarkdown('=pod\nS<*word*>\n')).toContain('\\*word\\*')
  })

  it('keeps a masked one hidden', () => {
    const html = asHtml('=pod\n=for para :masked\nS<secret word>\n')
    expect(html).not.toContain('secret')
  })
})
