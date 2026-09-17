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
  // a renderer does not read another document, and gives a link with no text of its
  // own the target as written: no title can come in through either
  it('a link into another document shows its target, not a title from there', () => {
    for (const mode of ['production', 'draft'] as Mode[]) {
      expect(html('See L<doc:./file.podlite>.', mode)).toMatch(/>doc:\.(\/|&#x2F;)file\.podlite<\/a>/)
      expect(markdown('See L<doc:./file.podlite>.', mode)).toContain('[doc:./file.podlite]')
    }
  })

  it('a backlink with no text of its own shows its target, not the hidden heading', () => {
    const doc = 'W<#sec-secret>\n\n=for head1 :id<sec-secret> :masked\nVelk Process'
    for (const mode of ['production', 'draft'] as Mode[]) {
      expect(html(doc, mode)).toContain('class="backlink">#sec-secret</a>')
      expect(html(doc, mode).match(/class="backlink">[^<]*/)?.[0]).not.toContain('Velk')
    }
  })

  it('hidden data is not inlined by an include', () => {
    // =include does not read =data at all yet, so nothing is inlined in either mode
    const doc = '=begin data :key<creds> :masked\nsecret-token-xyz\n=end data\n\n=include data:creds'
    expect(html(doc)).not.toContain('secret-token-xyz')
    expect(markdown(doc)).not.toContain('secret-token-xyz')
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

describe('a table of contents hides what its source hides', () => {
  const both = (body: string, word: string) => {
    expect(tocOf(html(body))).not.toContain(word)
    expect(tocOf(html(body, 'draft'))).toContain(word)
  }

  it('in the entry of a hidden heading', () => {
    both('=toc head1\n\n=for head1 :masked\nKrin Phase\n\ntext', 'Krin')
  })

  it('in the entry of a heading with a hidden word, and shows the rest', () => {
    const doc = '=toc head1\n\n=head1 Project G<Aurox> plan\n\n=head1 Open title'
    both(doc, 'Aurox')
    expect(tocOf(html(doc))).toContain('Project')
    expect(tocOf(html(doc))).toContain('Open title')
  })

  it('in the entry of a hidden table listed by its caption', () => {
    both("=toc table\n\n=begin table :caption('Dravo Sales') :masked\na b\n=end table", 'Dravo')
  })

  it('in the entry of a heading inside a hidden container', () => {
    both('=begin nested :masked\n\n=head1 Inner Zent\n\n=end nested\n\n=toc head1', 'Zent')
  })

  it('in an entry whose heading holds a link, without a link inside the link', () => {
    const doc = '=toc head1\n\n=head1 G<Hidden> L<Visible|https://example.org>'
    both(doc, 'Hidden')
    expect(tocOf(html(doc)).split('<a').length - 1).toBe(1)
  })

  it('inside a link of the heading, and shows the open words of the link', () => {
    const doc = '=toc head1\n\n=head1 L<Visible G<Secret>|https://example.org>'
    both(doc, 'Secret')
    expect(tocOf(html(doc))).toContain('Visible')
  })

  it('in an entry whose heading holds an alias to a link', () => {
    const doc = '=alias BRAND L<AliasLink|https://example.org>\n\n=toc head1\n\n=head1 G<Hidden> A<BRAND>'
    both(doc, 'Hidden')
    expect(tocOf(html(doc)).split('<a').length - 1).toBe(1)
  })

  it('without a second note for a note in the heading', () => {
    const out = html('=toc head1\n\n=head1 G<N<NoteSecret>> Title', 'draft')
    expect(out.split('NoteSecret').length - 1).toBe(1)
  })

  it('in every entry of a hidden table of contents', () => {
    const doc = '=for toc :masked :caption<TocSecret>\nhead1\n\n=head1 Public Qor'
    expect(tocOf(html(doc))).not.toContain('Public Qor')
    expect(tocOf(html(doc, 'draft'))).toContain('Public Qor')
  })

  it('in the entry of a hidden picture, a list item and a code block', () => {
    both("=toc Image\n\n=for Image :masked :caption('Vorn Map')\npic.png", 'Vorn')
    both('=toc item\n\n=item G<Pell> point', 'Pell')
    both('=toc code\n\n=begin code :allow<G>\nkey G<sk-7731>\n=end code', 'sk-7731')
  })

  it('in an entry read from the body although the block has a caption', () => {
    both('=toc item\n\n=for item :caption<Label>\nG<Sekra> public', 'Sekra')
    both('=toc head1\n\n=for head1 :caption<>\nG<Sekrb> public', 'Sekrb')
  })

  it('in an entry that keeps the characters of an entity', () => {
    const doc = '=toc head1\n\n=for head1 :id<h>\nG<Hidden> E<amp> E<0x41> end'
    both(doc, 'Hidden')
    expect(tocOf(html(doc))).toContain('&amp; A end')
  })

  it('in an entry that stays inline, with no block inside the link', () => {
    const item = tocOf(html('=toc item\n\n=item G<Pell> point'))
    expect(item.split('<p').length - 1).toBe(1)
    const nested = tocOf(html('=toc nested\n\n=begin nested\n=head1 G<Orsk> part\n=end nested'))
    expect(nested).not.toContain('<h1')
    expect(nested).not.toContain('Orsk')
  })

  it('in each of two tables of contents', () => {
    const out = html('=toc head1\n\n=head1 G<Wexa> one\n\n=toc head1')
    expect(out).not.toContain('Wexa')
  })
})
