import { Podlite } from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { podlite as podliteCore } from 'podlite'

// Paths by which hidden content could reach the page. Each path the page itself
// closes is checked where it is closed; this file holds the paths that do not leak
// through the page at all, the ones the page takes on its own, and the ones still open.

type Mode = 'production' | 'draft'

const page = (body: string, mode: Mode = 'production', props = {}) =>
  renderToStaticMarkup(
    <Podlite renderMode={mode} {...props}>
      {`=begin pod\n\n${body}\n\n=end pod\n`}
    </Podlite>,
  )
const tocOf = (out: string) => out.slice(out.indexOf('<div class="toc">'), out.indexOf('</ul></div>'))

const hiddenOnPage = (body: string, word: string, props = {}) => {
  expect(page(body, 'production', props)).not.toContain(word)
  expect(page(body, 'draft', props)).toContain(word)
}

describe('paths hidden content does not take onto the page', () => {
  // the page does not read another document, and gives a link with no text of its
  // own the target as written: no title can come in through either
  it('a link into another document shows its target, not a title from there', () => {
    for (const mode of ['production', 'draft'] as Mode[]) {
      expect(page('See L<doc:./file.podlite>.', mode)).toContain('>doc:./file.podlite</a>')
    }
  })

  it('a backlink with no text of its own shows its target, not the hidden heading', () => {
    const doc = 'W<#sec-secret>\n\n=for head1 :id<sec-secret> :masked\nVelk Process'
    for (const mode of ['production', 'draft'] as Mode[]) {
      expect(page(doc, mode)).toContain('class="backlink">#sec-secret</a>')
    }
  })

  it('hidden data is not inlined by an include', () => {
    // =include does not read =data at all yet, so nothing is inlined in either mode
    const doc = '=begin data :key<creds> :masked\nsecret-token-xyz\n=end data\n\n=include data:creds'
    expect(page(doc)).not.toContain('secret-token-xyz')
  })

  it('an index term inside hidden content is hidden', () => {
    hiddenOnPage('=for para :masked\nThis describes X<Plix|RSA-Plix>.', 'Plix')
  })

  it('a table built from hidden data is hidden', () => {
    hiddenOnPage(
      '=begin data :key<rows> :masked :mime-type<text/csv>\nname,secret\nalpha,Foobsecret\n=end data\n\n=table data:rows',
      'Foobsecret',
    )
  })

  it('hidden data does not reach a picture that names it', () => {
    // a picture does not read =data at all yet, so nothing is shown in either mode
    const doc = '=begin data :key<img> :masked\nGlimdata\n=end data\n\n=picture data:img'
    expect(page(doc)).not.toContain('Glimdata')
  })

  it('a block nested in hidden content is hidden with it', () => {
    hiddenOnPage('=begin nested :masked\n=para Hollo inner\n=end nested', 'Hollo')
  })

  it('a hidden document hides its headings and text', () => {
    hiddenOnPage('=begin pod :masked\n=head1 Wexa\n\nWexa text\n=end pod', 'Wexa')
  })

  it('hidden content brought in by an include drawn on the page is hidden', () => {
    const includeReader = (path: string) =>
      path === 'part.podlite' ? '=begin pod\n=for para :masked\nIncluvar words\n=end pod\n' : null
    hiddenOnPage('=include file:part.podlite', 'Incluvar', { includeReader })
  })
})

describe('a table of contents on the page hides what its source hides', () => {
  const both = (body: string, word: string) => {
    expect(tocOf(page(body))).not.toContain(word)
    expect(tocOf(page(body, 'draft'))).toContain(word)
  }

  it('in the entry of a hidden heading', () => {
    both('=toc head1\n\n=for head1 :masked\nKrin Phase\n\ntext', 'Krin')
  })

  it('in the entry of a heading with a hidden word, and shows the rest', () => {
    both('=toc head1\n\n=head1 Project G<Aurox> plan', 'Aurox')
    expect(tocOf(page('=toc head1\n\n=head1 Project G<Aurox> plan'))).toContain('Project')
  })

  it('in the entry of a hidden table listed by its caption', () => {
    both("=toc table\n\n=begin table :caption('Dravo Sales') :masked\na b\n=end table", 'Dravo')
  })

  it('in an entry read from the body although the block has a caption', () => {
    both('=toc item\n\n=for item :caption<Label>\nG<Sekra> public', 'Sekra')
    both('=toc head1\n\n=for head1 :caption<>\nG<Sekrb> public', 'Sekrb')
  })

  it('in the caption and the entries of a hidden table of contents', () => {
    const doc = '=for toc :masked :caption<TocSecret> :folded\nhead1\n\n=head1 Public Qor'
    const out = page(doc)
    expect(out).not.toContain('TocSecret')
    expect(out.slice(0, out.indexOf('<h1'))).not.toContain('Public Qor')
    expect(page(doc, 'draft')).toContain('TocSecret')
  })
})

describe('the caption of a table of contents on the page', () => {
  const captionOf = (out: string): string => {
    const found = /class="toctitle">([\s\S]*?)<\/(div|summary)>/.exec(out)
    if (!found) throw new Error('the table of contents has no caption')
    return found[1]
  }
  const toc = (caption: string) => `=for toc ${caption}\nhead1\n\n=head1 One`

  it('hides a hidden word of its own and shows the rest', () => {
    expect(captionOf(page(toc(":caption('Tests')")))).toBe('Tests')
    expect(captionOf(page(toc(":title('Tests')")))).toBe('Tests')
    for (const written of ['Public G<Secret>', 'Public G«Secret»']) {
      expect(captionOf(page(toc(`:caption('${written}')`)))).toBe('Public <span class="masked">██████</span>')
      expect(captionOf(page(toc(`:caption('${written}')`), 'draft'))).toContain('Secret')
    }
  })

  it('renders the markup written in it', () => {
    expect(captionOf(page(toc(":caption('The C<G<>> code')")))).toBe('The <code>G&lt;&gt;</code> code')
    expect(captionOf(page(toc(":caption('Plain B<bold>')")))).toBe('Plain <strong>bold</strong>')
    expect(captionOf(page(toc(":caption('See L<text|#One>')")))).toContain('>text</a>')
    expect(captionOf(page(toc(":caption('a < b & c')")))).toBe('a &lt; b &amp; c')
  })

  it('registers a note of its own once and keeps no index code as text', () => {
    const out = page(toc(":caption('With N<note> X<term>')"))
    expect(out.split('id="fnref:').length - 1).toBe(1)
    expect(captionOf(out)).not.toContain('X&lt;')
  })

  it('is hidden with a hidden table of contents, and parsed when the table is folded', () => {
    expect(captionOf(page(toc(':masked :caption<TocSecret>')))).toBe('█████████')
    expect(captionOf(page(toc(':masked :caption<TocSecret>'), 'draft'))).toBe('TocSecret')
    expect(captionOf(page(toc(":folded :caption('Map G<Vorn>')")))).toBe('Map <span class="masked">████</span>')
  })

  // a tree built before the caption was parsed carries the title string alone
  it('hides a title string with a hidden word when no caption was parsed', () => {
    const withoutCaption = (doc: string) => {
      const p = podliteCore({ importPlugins: true })
      const tree = p.toAstResult(p.parse(doc, { podMode: 1 }))
      const strip = (node: unknown): void => {
        if (Array.isArray(node)) return node.forEach(strip)
        if (typeof node !== 'object' || node === null) return
        if (Reflect.get(node, 'type') === 'toc') Reflect.deleteProperty(node, 'caption')
        strip(Reflect.get(node, 'content'))
      }
      strip(tree.interator)
      return (mode: Mode) => renderToStaticMarkup(<Podlite tree={tree} renderMode={mode} />)
    }
    const hidden = withoutCaption(toc(":caption('Public G<Secret>')"))
    expect(captionOf(hidden('production'))).toBe('██████ █████████')
    expect(captionOf(hidden('draft'))).toBe('Public G&lt;Secret&gt;')
  })
})
