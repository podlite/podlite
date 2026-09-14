import { toAnyRules, toHtml, toMarkdown } from '@podlite/schema'
import { podlite } from '../src/index'

// Paths by which hidden content could reach html and markdown output. Each path
// the renderers themselves close is checked where it is closed; this file holds the
// paths that do not leak through a renderer at all, and the ones still open.

type Mode = 'production' | 'draft'

const p = podlite({ importPlugins: true })
const tree = (body: string) => p.toAst(p.parse(`=begin pod\n\n${body}\n\n=end pod\n`, { podMode: 1 }))
const htmlResult = (body: string, mode: Mode = 'production') =>
  toHtml({ renderMode: mode }).use(toAnyRules('toHtml', p.getPlugins())).run(tree(body))
const html = (body: string, mode: Mode = 'production') => String(htmlResult(body, mode))
const markdown = (body: string, mode: Mode = 'production') =>
  String(toMarkdown({ renderMode: mode }).use(toAnyRules('toMarkdown', p.getPlugins())).run(tree(body)))
const tocOf = (out: string) =>
  out.slice(out.indexOf('<div className="toc">'), out.indexOf('</div>', out.indexOf('<div className="toc">')))

const hiddenIn = (body: string, word: string) => {
  for (const render of [html, markdown]) {
    expect(render(body)).not.toContain(word)
    expect(render(body, 'draft')).toContain(word)
  }
}

describe('paths hidden content does not take through a renderer', () => {
  it('a link into another document shows no title taken from it', () => {
    hiddenIn('=NAME Project G<Qwyx>\n\nSee L<doc:./file.podlite>.', 'Qwyx')
  })

  it('a backlink to a hidden heading shows only its own words', () => {
    hiddenIn('=for head1 :id<sec-secret> :masked\nVelk Process\n\nW<related|#sec-secret>', 'Velk')
  })

  it('an index term inside hidden content is hidden and not collected', () => {
    const doc = '=for para :masked\nThis describes X<Plix|RSA-Plix>.'
    hiddenIn(doc, 'Plix')
    expect(JSON.stringify(htmlResult(doc).indexingTerms)).not.toContain('Plix')
  })

  it('hidden data does not reach a picture that names it', () => {
    // a picture does not read =data at all yet, so nothing is shown in either mode
    const doc = '=begin data :key<img> :masked\nGlimdata\n=end data\n\n=picture data:img'
    expect(html(doc)).not.toContain('Glimdata')
    expect(markdown(doc)).not.toContain('Glimdata')
  })

  it('an alias declared in hidden content does not expand outside it', () => {
    // the alias does not expand outside its block at all, so this holds in draft too
    const doc = '=begin pod :masked\n=alias COMPANY Zentix\n=end pod\n\nWe work at A<COMPANY>.'
    expect(html(doc)).not.toContain('Zentix')
    expect(markdown(doc)).not.toContain('Zentix')
  })

  it('a block nested in hidden content is hidden with it', () => {
    hiddenIn('=begin nested :masked\n=para Hollo inner\n=end nested', 'Hollo')
  })

  it('a hidden document hides its headings and text', () => {
    hiddenIn('=begin pod :masked\n=head1 Wexa\n\nWexa text\n=end pod', 'Wexa')
  })

  it('markdown writes no table of contents, so a hidden caption is not listed there', () => {
    const doc = "=toc table\n\n=begin table :caption('Dravo Sales') :masked\na b\n=end table"
    expect(markdown(doc)).not.toContain('Dravo')
  })
})

// A table of contents is built before hidden content is marked, so its entries
// carry the text as written. Each check below states that the leak is still there:
// it turns red once the entries are built after the marking, and is then turned
// around into a check that the text is hidden.
describe('a table of contents still shows hidden text', () => {
  it('in the entry of a hidden heading', () => {
    expect(tocOf(html('=toc head1\n\n=for head1 :masked\nKrin Phase\n\ntext'))).toContain('Krin')
  })

  it('in the entry of a heading with a hidden word', () => {
    expect(tocOf(html('=toc head1\n\n=head1 Project G<Aurox> plan'))).toContain('Aurox')
  })

  it('in the entry of a hidden table listed by its caption', () => {
    const doc = "=toc table\n\n=begin table :caption('Dravo Sales') :masked\na b\n=end table"
    expect(tocOf(html(doc))).toContain('Dravo')
  })
})
