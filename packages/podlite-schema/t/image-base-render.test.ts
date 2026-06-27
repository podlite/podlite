import toMarkdown from '../src/exportMarkdown'
import toHtml from '../src/exportHtml'

const img = (src: string) => ({ type: 'image', src, alt: 'a' })
const md = (src: string, base?: string) =>
  toMarkdown({ base })
    .run([img(src)])
    .toString()
const html = (src: string, base?: string) =>
  toHtml({ base })
    .run([img(src)])
    .toString()

describe('export applies image base', () => {
  it('markdown prefixes a relative file image with the base', () => {
    expect(md('demo.png', 'https://cdn/x')).toContain('](https://cdn/x/demo.png)')
  })
  it('markdown leaves an absolute image path untouched', () => {
    expect(md('/local/x.png', 'https://cdn/x')).toContain('](/local/x.png)')
  })
  it('markdown without a base leaves the source unchanged', () => {
    expect(md('demo.png')).toContain('](demo.png)')
  })
  it('html prefixes a relative file image with the base', () => {
    expect(html('demo.png', 'https://cdn/x')).toContain('src="https://cdn/x/demo.png"')
  })
  it('html leaves an https image untouched', () => {
    expect(html('https://other/i.jpg', 'https://cdn/x')).toContain('src="https://other/i.jpg"')
  })
})
