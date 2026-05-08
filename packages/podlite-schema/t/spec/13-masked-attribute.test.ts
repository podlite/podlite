import { toTree, toHtml, toMarkdown } from '../../src'

const parseDoc = (src: string) => toTree().parse(src, { podMode: 1, skipChain: 0 })

describe(':masked block attribute', () => {
  describe('HTML', () => {
    it('masks paragraph content in production mode', () => {
      const html = toHtml({}).run(parseDoc('=for para :masked\nThe quick brown fox\n')).toString()
      expect(html).toContain('<p>')
      expect(html).toContain('███ █████ █████ ███')
      expect(html).not.toContain('quick')
    })

    it('renders paragraph content in draft mode', () => {
      const html = toHtml({ renderMode: 'draft' }).run(parseDoc('=for para :masked\nThe quick brown fox\n')).toString()
      expect(html).toContain('The quick brown fox')
    })

    it(':!masked does not mask', () => {
      const html = toHtml({}).run(parseDoc('=for para :!masked\nVisible content\n')).toString()
      expect(html).toContain('Visible content')
    })

    it('masks heading content', () => {
      const html = toHtml({}).run(parseDoc('=for head1 :masked\nSecret Title\n')).toString()
      expect(html).toContain('<h1>')
      expect(html).toContain('██████ █████')
      expect(html).not.toContain('Secret')
    })

    it('masks code block verbatim content', () => {
      const html = toHtml({})
        .run(parseDoc('=begin code :lang<py> :masked\napi_key = "sk-12345"\n=end code\n'))
        .toString()
      expect(html).toContain('<pre><code>')
      expect(html).toContain('███████ █ ██████████')
      expect(html).not.toContain('sk-12345')
    })

    it('masks nested blocks recursively', () => {
      const html = toHtml({})
        .run(parseDoc('=begin nested :masked\n=head2 Title\n\n=para inner para\n=end nested\n'))
        .toString()
      expect(html).toContain('█████')
      expect(html).not.toContain('Title')
      expect(html).not.toContain('inner')
    })

    it('G<> inside :masked block remains masked (idempotent)', () => {
      const html = toHtml({}).run(parseDoc('=for para :masked\nPublic G<secret> text\n')).toString()
      expect(html).not.toContain('secret')
      expect(html).not.toContain('Public')
    })
  })

  describe('Markdown', () => {
    it('masks paragraph in production mode', () => {
      const md = toMarkdown({}).run(parseDoc('=for para :masked\nHidden content\n')).toString()
      expect(md).toContain('██████ ███████')
      expect(md).not.toContain('Hidden')
    })

    it('renders paragraph in draft mode', () => {
      const md = toMarkdown({ renderMode: 'draft' }).run(parseDoc('=for para :masked\nHidden content\n')).toString()
      expect(md).toContain('Hidden content')
    })

    it('masks code block', () => {
      const md = toMarkdown({})
        .run(parseDoc('=begin code :lang<py> :masked\napi_key = "sk-12345"\n=end code\n'))
        .toString()
      expect(md).toContain('███████ █ ██████████')
      expect(md).not.toContain('sk-12345')
    })
  })
})
