import { toMarkdown } from '../src'

const render = (pod: string): string => toMarkdown({}).run(pod).toString()

describe('toMarkdown', () => {
  describe('paragraphs', () => {
    it('simple paragraph', () => {
      expect(render('=pod\nHello world\n')).toContain('Hello world')
    })
  })

  describe('headings', () => {
    it('head1', () => {
      expect(render('=pod\n=head1 Title\n')).toContain('# Title')
    })
    it('head2', () => {
      expect(render('=pod\n=head2 Subtitle\n')).toContain('## Subtitle')
    })
    it('head3', () => {
      expect(render('=pod\n=head3 Section\n')).toContain('### Section')
    })
  })

  describe('formatting codes', () => {
    it('bold', () => {
      expect(render('=pod\nB<bold text>\n')).toContain('**bold text**')
    })
    it('italic', () => {
      expect(render('=pod\nI<italic text>\n')).toContain('*italic text*')
    })
    it('code', () => {
      expect(render('=pod\nC<some code>\n')).toContain('`some code`')
    })
    it('link with url', () => {
      const result = render('=pod\nL<click here|https://example.com>\n')
      expect(result).toContain('[click here](https://example.com)')
    })
    it('bold and italic combined', () => {
      const result = render('=pod\nB<bold> and I<italic>\n')
      expect(result).toContain('**bold**')
      expect(result).toContain('*italic*')
    })
  })

  describe('code blocks', () => {
    it('abbreviated code block', () => {
      const result = render('=pod\n=begin code\nmy $x = 1;\n=end code\n')
      expect(result).toContain('```')
      expect(result).toContain('my $x = 1;')
    })
  })

  describe('lists', () => {
    it('unordered list', () => {
      const result = render('=pod\n=item First\n=item Second\n=item Third\n')
      expect(result).toContain('- First')
      expect(result).toContain('- Second')
      expect(result).toContain('- Third')
    })
  })

  describe('tables', () => {
    it('simple table with header', () => {
      const pod = `
=table
    Animal | Legs |    Eats
    =======================
    Zebra  +   4  + Cookies
    Human  +   2  +   Pizza

`
      const result = render(pod)
      expect(result).toContain('| Animal |')
      expect(result).toContain('| --- |')
      expect(result).toContain('| Zebra |')
    })

    it('table without header', () => {
      const pod = `
=for table
  mouse    | mice
  horse    | horses

`
      const result = render(pod)
      expect(result).toContain('| mouse |')
      expect(result).toContain('| --- |')
    })

    it('table with caption', () => {
      const pod = `
=begin table :caption('My Table')
foo
bar
=end table

`
      const result = render(pod)
      expect(result).toContain('**My Table**')
    })
  })

  describe('comments', () => {
    it('comment block is not rendered', () => {
      const result = render('=begin pod\n=comment This should not appear\n\nVisible text\n=end pod')
      expect(result).not.toContain('should not appear')
      expect(result).toContain('Visible text')
    })
  })

  describe('semantic blocks', () => {
    it('TITLE block', () => {
      const result = render('=begin pod\n=TITLE My Document\n=end pod\n')
      expect(result).toContain('TITLE')
      expect(result).toContain('My Document')
    })
  })

  describe('footnotes', () => {
    it('footnote reference and content', () => {
      const result = render('=pod\nText with noteN<footnote content>.\n')
      expect(result).toContain('[^1]')
      expect(result).toContain('[^1]:')
      expect(result).toContain('footnote content')
    })
  })

  describe('image', () => {
    it('renders image as markdown', () => {
      // image nodes are typically produced by plugins, test the rule directly
      const mdWriter = require('../src/writerMarkdown').default
      const toAny = require('../src/exportAny').toAny
      const result = toAny({ writer: mdWriter })
        .use({
          ':image': (writer, processor) => (node, ctx, interator) => {
            writer.writeRaw(`![${node.alt || ''}](${node.src})`)
          },
        })
        .run([{ type: 'image', src: 'photo.png', alt: 'A photo' }])
        .toString()
      expect(result).toBe('![A photo](photo.png)')
    })
  })

  describe('definitions', () => {
    it('definition list', () => {
      const pod = `=pod
=defn Term1
Definition of term1
`
      const result = render(pod)
      expect(result).toContain('**Term1:**')
      expect(result).toContain('Definition of term1')
    })
  })

  describe('nested/blockquote', () => {
    it('nested block produces blockquote', () => {
      const pod = `=begin pod
=begin nested
Quoted text
=end nested
=end pod
`
      const result = render(pod)
      expect(result).toContain('> ')
    })
  })
})
