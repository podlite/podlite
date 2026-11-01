import { podlite } from '../../core/src'
import { toHtml, toMarkdown, toAnyRules, getSafeNodeId, indexAnchors } from '../src'

// the path of the command line: the core with its plugins
const core = podlite({ importPlugins: true })
const tree = (doc: string) => core.toAst(core.parse(doc, { podMode: 1 }))
const html = (doc: string, renderMode = 'production') =>
  String(toHtml({ renderMode }).use(toAnyRules('toHtml', core.getPlugins())).run(tree(doc)))
// a heading of a title carries the id its parse gave it, which changes on every parse
const plain = (out: string) => out.replace(/ id="[A-Za-z0-9_-]{18,22}"/g, ' id="ID"')
const heading = (doc: string, renderMode?: string) =>
  (html(doc, renderMode).match(/<h1 class="TITLE"[^>]*>([\s\S]*?)<\/h1>/) || [])[1]

describe('the =TITLE block in the HTML output', () => {
  it('shows its content as the title, not the word TITLE', () => {
    expect(plain(html('=TITLE test\n'))).toBe('<h1 class="TITLE" id="ID">test\n</h1>')
    expect(plain(html('=TITLE My B<Doc>\n\n=para Body\n'))).toBe(
      '<h1 class="TITLE" id="ID">My <strong>Doc</strong>\n</h1><p>Body\n</p>',
    )
  })

  it('shows nothing for an empty title, and an anchor when it has an id', () => {
    expect(html('=TITLE\n\n=para Quick\n')).toBe('<p>Quick\n</p>')
    expect(html('=begin TITLE :id<doc-title>\n=end TITLE\n')).toBe('<span id="doc-title"></span>')
    expect(html('=TITLE Z<hidden>\n')).toBe('')
  })

  it('writes the paragraphs in one heading and other blocks after it', () => {
    expect(heading('=begin TITLE\nOne\n\nTwo\n=end TITLE\n')).toBe('One\n Two\n')
    expect(plain(html('=begin TITLE\nUsing\n\n=begin code\nx\n=end code\n=end TITLE\n'))).toBe(
      '<h1 class="TITLE" id="ID">Using\n</h1><pre><code>x\n</code></pre>',
    )
    expect(html('=begin TITLE\n=begin code\nonly\n=end code\n=end TITLE\n')).toBe('<pre><code>only\n</code></pre>')
  })

  it('puts the id the author wrote on the heading', () => {
    expect(html('=for TITLE :id<doc-title>\nMy Doc\n')).toBe('<h1 class="TITLE" id="doc-title">My Doc\n</h1>')
  })

  it('hides what the title hides and shows it in a draft', () => {
    expect(heading('=TITLE My G<Secret>\n')).toBe('My <span class="masked">██████</span>\n')
    expect(heading('=TITLE My G<Secret>\n', 'draft')).toContain('Secret')
    expect(heading('=for TITLE :masked\nSecret\n')).not.toContain('Secret')
  })

  it('lets a directive act from where it stands and renders the content once', () => {
    expect(heading('=begin TITLE\n=alias L B<Doc>\n\nA<L>\n=end TITLE\n')).toBe('<strong>Doc</strong>\n')
    const out = html('=TITLE N<note>\n')
    expect(out.match(/\[1\]/g)).toHaveLength(2)
    expect(out).not.toContain('[2]')
  })

  it('shows a title after a paragraph the same way', () => {
    expect(plain(html('=para Intro\n\n=TITLE Late\n'))).toBe('<p>Intro\n</p><h1 class="TITLE" id="ID">Late\n</h1>')
  })

  it('gives a title and a heading of the same words ids of their own', () => {
    const out = html('=begin pod\n=TITLE Same\n\n=head1 Same\n=end pod\n')
    const ids = [...out.matchAll(/<h1[^>]* id="([^"]+)"/g)].map(found => found[1])
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
  })

  it('leads an entry of the contents to the heading of a title without an id', () => {
    const out = html('=begin pod\n=toc TITLE\n\n=TITLE test\n=end pod\n')
    const href = (out.match(/<a href="#([^"]+)"/) || [])[1]
    const id = (out.match(/<h1 class="TITLE" id="([^"]+)"/) || [])[1]
    expect(href).toBeTruthy()
    expect(href).toBe(id)
  })

  it('gives the heading the id the anchors of the same tree give it', () => {
    const parsed = tree('=begin pod\n=TITLE test\n=end pod\n')
    const title = (parsed.content[0] as { content: any[] }).content.find(node => node.name === 'TITLE')
    const expected = getSafeNodeId(title, { __anchors: indexAnchors(parsed) })
    const out = String(toHtml({}).use(toAnyRules('toHtml', core.getPlugins())).run(parsed))
    expect(out).toContain(`<h1 class="TITLE" id="${expected}">`)
  })

  it('gives no link to a title with nothing to show and no id', () => {
    for (const body of ['', 'Z<hidden>', 'E<32>', 'N<>']) {
      const out = html(`=begin pod\n=toc TITLE\n\n=TITLE ${body}\n=end pod\n`)
      const hrefs = [...out.matchAll(/href="#([^"]+)"/g)].map(found => found[1])
      const ids = [...out.matchAll(/ id="([^"]+)"/g)].map(found => found[1])
      expect(hrefs.filter(href => !ids.includes(href))).toEqual([])
    }
  })

  it('lets each alias act from its place and numbers the notes in the order of the source', () => {
    expect(heading('=begin TITLE\n=alias L First\n\nA<L>\n\n=alias L Second\n\nA<L>\n=end TITLE\n')).toBe(
      'First\n Second\n',
    )
    const out = html('=begin TITLE\n=item point N<first>\n\nTitle N<second>\n=end TITLE\n')
    expect(heading('=begin TITLE\n=item point N<first>\n\nTitle N<second>\n=end TITLE\n')).toContain('[2]')
    expect(out).toMatch(/point <sup[^>]*><a[^>]*>\[1\]/)
  })

  it('leads an entry of the contents to the id the author gave the title', () => {
    const out = html('=begin pod\n=toc TITLE\n\n=for TITLE :id<doc-title>\nThe Specification\n=end pod\n')
    expect(out).toContain('<a href="#doc-title">')
    expect(out).toContain('<h1 class="TITLE" id="doc-title">')
  })
})

describe('what stays as it was', () => {
  it('writes another semantic block under its name', () => {
    expect(html('=SYNOPSIS Text\n')).toBe('<h1 class="SYNOPSIS">SYNOPSIS</h1><p>Text\n</p>')
    expect(html('=NAME Name\n')).toBe('<h1 class="NAME">NAME</h1><p>Name\n</p>')
    expect(html('=SUBTITLE Sub\n')).toBe('<h1 class="SUBTITLE">SUBTITLE</h1><p>Sub\n</p>')
  })

  it('leaves the markdown output of a title as it was', () => {
    const out = String(toMarkdown({}).use(toAnyRules('toMarkdown', core.getPlugins())).run(tree('=TITLE test\n')))
    expect(out).toBe('# TITLE\n\ntest\n\n')
  })
})
