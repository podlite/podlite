import { toTree, toHtml, toMarkdown } from '../../src'

const parseDoc = (src: string) => toTree().parse(src, { podMode: 1, skipChain: 0 })

describe('G<> guarded markup code', () => {
  it('parses G<> as fcode named G', () => {
    const tree = parseDoc('=pod\nG<hunter2>\n')
    const para = (tree as any[])[0].content[0]
    const fcode = para.content.find(n => n && n.type === 'fcode')
    expect(fcode).toMatchObject({ type: 'fcode', name: 'G' })
  })

  describe('HTML', () => {
    it('production mode masks non-whitespace with U+2588', () => {
      const html = toHtml({}).run(parseDoc('=pod\nG<hunter2>\n')).toString()
      expect(html).toContain('<span class="masked">███████</span>')
    })

    it('draft mode preserves original content', () => {
      const html = toHtml({ renderMode: 'draft' }).run(parseDoc('=pod\nG<hunter2>\n')).toString()
      expect(html).toContain('<span class="masked-draft">')
      expect(html).toContain('hunter2')
    })

    it('preserves whitespace in production mode', () => {
      const html = toHtml({}).run(parseDoc('=pod\nG<two words>\n')).toString()
      expect(html).toContain('███ █████')
    })

    it('masks nested formatting codes uniformly', () => {
      const html = toHtml({}).run(parseDoc('=pod\nB<G<secret>>\n')).toString()
      expect(html).toContain('<span class="masked">██████</span>')
    })
  })

  describe('Markdown', () => {
    it('production mode masks content', () => {
      const md = toMarkdown({}).run(parseDoc('=pod\nG<hunter2>\n')).toString()
      expect(md).toContain('███████')
      expect(md).not.toContain('hunter2')
    })

    it('draft mode preserves content', () => {
      const md = toMarkdown({ renderMode: 'draft' }).run(parseDoc('=pod\nG<hunter2>\n')).toString()
      expect(md).toContain('hunter2')
    })
  })
})
