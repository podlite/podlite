import { podlite } from '../src/index'
import { toMarkdown } from '@podlite/schema'

const tree = (source: string) => {
  const p = podlite({ importPlugins: true })
  return { p, ast: p.toAst(p.parse(`=begin pod\n${source}\n=end pod\n`, { podMode: 1 })) }
}
const html = (source: string) => {
  const { p, ast } = tree(source)
  return p.toHtml(ast).toString()
}
const markdown = (source: string) => toMarkdown({}).run(tree(source).ast).toString()
const fixture = '=begin picture :src<orbit.svg>\ndata:Logo\n\nThe B<second> paragraph.\n=end picture\n'

describe('a =picture read by the norm through the whole package', () => {
  it('writes the source of :src and both paragraphs of the body in html and markdown', () => {
    expect(html(fixture)).toContain(
      '<img src="orbit.svg"/><div class="caption"><p>data:Logo</p><p>The <strong>second</strong> paragraph.</p></div>',
    )
    expect(markdown(`${fixture}\n=para After\n`)).toContain(
      '![](orbit.svg)\n\ndata:Logo\n\nThe **second** paragraph.\n\nAfter\n',
    )
  })

  it('writes no picture for an abbreviated block, and its text as the caption', () => {
    expect(html('=picture data:Logo\n')).not.toContain('<img')
    expect(html('=picture data:Logo\n')).toContain('<div class="caption">data:Logo')
    expect(markdown('=picture data:Logo\n\n=para After\n')).toContain('data:Logo\n\nAfter\n')
  })

  it('titles a picture in the table of contents by :caption, and by its body without one', () => {
    const out = html(
      "=toc picture\n\n=begin picture :src<a.png> :caption('Orbit')\nFirst.\n\nSecond.\n=end picture\n\n=begin picture :src<b.png>\nOne.\n\nTwo.\n=end picture\n",
    )
    const entries = [...out.matchAll(/<li[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/g)].map(m => m[1].trim())
    expect(entries).toEqual(['Orbit', 'One. Two.'])
  })
})
