import { toMarkdown, toHtml } from '@podlite/schema'
import { podlite } from '../src/index'

const build = (src: string) => {
  const p = podlite({ importPlugins: true })
  return p.toAst(p.parse(src, { podMode: 1 }))
}
const md = (src: string, base?: string) => toMarkdown({ base }).run(build(src)).toString()
const html = (src: string, base?: string) => toHtml({ base }).run(build(src)).toString()

describe('convert renders pictures and applies the base', () => {
  it('turns =picture into an image and prefixes a relative source', () => {
    expect(md('=pod\n=picture demo.png\n', 'https://cdn/x')).toContain('![](https://cdn/x/demo.png)')
  })

  it('leaves an absolute picture path untouched', () => {
    expect(md('=pod\n=picture /abs/x.png\n', 'https://cdn/x')).toContain('![](/abs/x.png)')
  })

  it('leaves an https picture untouched', () => {
    expect(md('=pod\n=picture https://other/i.jpg\n', 'https://cdn/x')).toContain('![](https://other/i.jpg)')
  })

  it('renders a picture unchanged without a base', () => {
    expect(md('=pod\n=picture demo.png\n')).toContain('![](demo.png)')
  })

  it('applies the base in html and omits an empty alt value', () => {
    const out = html('=pod\n=picture demo.png\n', 'https://cdn/x')
    expect(out).toContain('src="https://cdn/x/demo.png"')
    expect(out).not.toContain('alt="undefined"')
  })
})
