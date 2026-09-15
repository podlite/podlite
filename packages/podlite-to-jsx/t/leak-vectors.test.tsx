import { Podlite } from '../src/index'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

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

// A table of contents is built before hidden content is marked, so its entries
// carry the text as written. Each check below states that the leak is still there:
// it turns red once the entries are built after the marking, and is then turned
// around into a check that the text is hidden.
describe('a table of contents on the page still shows hidden text', () => {
  it('in the entry of a hidden heading', () => {
    expect(tocOf(page('=toc head1\n\n=for head1 :masked\nKrin Phase\n\ntext'))).toContain('Krin')
  })

  it('in the entry of a heading with a hidden word', () => {
    expect(tocOf(page('=toc head1\n\n=head1 Project G<Aurox> plan'))).toContain('Aurox')
  })

  it('in the entry of a hidden table listed by its caption', () => {
    const doc = "=toc table\n\n=begin table :caption('Dravo Sales') :masked\na b\n=end table"
    expect(tocOf(page(doc))).toContain('Dravo')
  })
})
