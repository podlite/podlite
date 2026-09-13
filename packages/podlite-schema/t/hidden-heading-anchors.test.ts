import { toHtml, toMarkdown } from '../src'
import { podlite } from '../../core/src'

type Mode = 'production' | 'draft'

const p = podlite({ importPlugins: true })
const tree = (body: string) => p.toAst(p.parse(`=begin pod\n\n${body}\n\n=end pod\n`, { podMode: 1 }))
const html = (body: string, mode: Mode = 'production') =>
  String(toHtml({ renderMode: mode }).run(tree(body))).replace(/\n/g, '')
const markdown = (body: string, mode: Mode = 'production') => String(toMarkdown({ renderMode: mode }).run(tree(body)))
const headingIds = (out: string) => [...out.matchAll(/<h\d id="([^"]*)"/g)].map(m => m[1])

describe('a heading with hidden text gets an address not made of it', () => {
  const doc = '=for head1 :masked\nZorg Title\n\nSee L<jump|#Zorg Title>.'

  it('names the heading without its text, in both modes', () => {
    expect(headingIds(html(doc))).toEqual(['masked-1'])
    expect(headingIds(html(doc, 'draft'))).toEqual(['masked-1'])
  })

  it('sends a link by its name to that address', () => {
    expect(html(doc)).toContain('href="#masked-1"')
    expect(html(doc)).not.toContain('Zorg')
  })

  it('sends a link by its shaped name to the same address', () => {
    expect(html('=for head1 :masked\nZorg Title\n\nSee L<jump|#Zorg-Title>.')).toContain('href="#masked-1"')
  })

  it('treats a heading with a hidden word the same way', () => {
    const out = html('=head1 Project G<Aurox> plan\n\nSee L<jump|#Project Aurox plan>.')
    expect(headingIds(out)).toEqual(['masked-1'])
    expect(out).toContain('href="#masked-1"')
  })

  it('leaves the address alone when the hidden part shows nothing', () => {
    expect(headingIds(html('=head1 Public G<> notes'))).toEqual(['Public-notes'])
    expect(headingIds(html('=head1 Public G< > notes'))).toEqual(['Public-notes'])
  })

  it('counts a character written as a code as hidden text', () => {
    expect(headingIds(html('=head1 Public G<E<65>> notes'))).toEqual(['masked-1'])
  })

  it('names a heading inside a hidden document', () => {
    expect(headingIds(html('=begin pod :masked\n=head1 Wexa\n=end pod'))).toEqual(['masked-1'])
  })

  it('keeps an id the author wrote, and a link by the hidden text goes there', () => {
    const out = html('=for head1 :id<safe> :masked\nSecrt\n\nSee L<jump|#Secrt>.')
    expect(headingIds(out)).toEqual(['safe'])
    expect(out).toContain('href="#safe"')
    expect(out).not.toContain('Secrt')
  })

  it('gives two hidden headings two addresses', () => {
    expect(headingIds(html('=for head1 :masked\nOne\n\n=for head1 :masked\nTwo'))).toEqual(['masked-1', 'masked-2'])
  })

  it('does not take an address an author gave a paragraph', () => {
    const out = html('=for head1 :masked\nSecret\n\n=for para :id<masked-1>\nPublic')
    expect(headingIds(out)).toEqual(['masked-2'])
  })

  it('leaves an open heading its own name when it is the generated one', () => {
    expect(headingIds(html('=for head1 :masked\nSecret\n\n=head1 masked-1'))).toEqual(['masked-2', 'masked-1'])
  })

  it('sends a table of contents entry to the address', () => {
    const out = html('=toc head1\n\n=for head1 :masked\nKrin Phase\n\ntext')
    expect(out).toContain('href="#masked-1"')
    expect(out).not.toContain('href="#Krin')
  })
})

describe('a hidden heading takes no place in the count of repeats', () => {
  const openAddresses = (out: string) => headingIds(out).filter(id => !id.startsWith('masked-'))

  it('leaves the open neighbours numbered as if it were not there', () => {
    const withHidden = html('=for head1 :masked\nSecret\n\n=head1 Secret\n\n=head1 Secret')
    const without = html('=head1 Secret\n\n=head1 Secret')
    expect(openAddresses(withHidden)).toEqual(headingIds(without))
    expect(openAddresses(withHidden)).toEqual(['Secret', 'Secret-2'])
  })

  it('does so when only the shaped names agree', () => {
    const withHidden = html('=for head1 :masked\nQ3: layoffs!\n\n=head1 Q3 layoffs')
    expect(openAddresses(withHidden)).toEqual(['Q3-layoffs'])
  })

  it('does not capture a link that names an open heading exactly', () => {
    const out = html('=for head1 :masked\nAlpha\n\n=head1 alpha\n\nSee L<jump|#alpha>.')
    expect(out).toContain('href="#alpha"')
  })
})

describe('the markdown output writes an address the reader cannot build', () => {
  it('puts a named anchor before a hidden heading and links to it, in both modes', () => {
    const doc = '=for head1 :masked\nZorg Title\n\nSee L<jump|#Zorg Title>.'
    for (const mode of ['production', 'draft'] as Mode[]) {
      const out = markdown(doc, mode)
      expect(out).toContain('<a name="masked-1"></a>\n\n# ')
      expect(out).toContain('[jump](#masked-1)')
    }
    expect(markdown(doc)).not.toContain('Zorg')
  })

  it('puts a named anchor before a heading with an id the author wrote', () => {
    const out = markdown('=for head1 :id<intro>\nIntroduction to the thing\n\nSee L<jump|#intro>.')
    expect(out).toContain('<a name="intro"></a>\n\n# Introduction to the thing')
    expect(out).toContain('[jump](#intro)')
  })

  it('addresses a numbered heading with its number', () => {
    const out = markdown('=config head1 :numbered\n\n=head1 Intro\n\n=head1 Details\n\nSee L<jump|#Details>.')
    expect(out).toContain('[jump](#2-details)')
  })

  it('counts empty names the way the reader does', () => {
    const out = markdown('=for head1 :masked\nAlpha\n\n=for head1 :masked\nBeta\n\n=head1 -1\n\nSee L<jump|#-1>.')
    expect(out).toContain('[jump](#-1-1)')
  })

  it('keeps a generated name clear of a heading the reader addresses the same way', () => {
    const out = markdown('=for head1 :masked\nSecret\n\n=head1 Masked-1\n\nSee L<jump|#Masked-1>.')
    expect(out).toContain('<a name="masked-2"></a>')
    expect(out).toContain('[jump](#masked-1)')
    expect(headingIds(html('=for head1 :masked\nSecret\n\n=head1 Masked-1'))).toEqual(['masked-2', 'Masked-1'])
  })

  it('keeps a generated name clear of a number the reader gives a repeat', () => {
    const doc = '=for head1 :masked\nSecret\n\n=head1 masked\n\n=head1 masked'
    expect(headingIds(html(doc))).toEqual(['masked-3', 'masked', 'masked-2'])
    expect(markdown(doc)).toContain('<a name="masked-3"></a>')
  })

  it('does not let the hidden text choose the generated name', () => {
    const one = html('=for head1 :masked\nMasked 1\n\n=head1 Public')
    const other = html('=for head1 :masked\nSomething else\n\n=head1 Public')
    expect(headingIds(one)).toEqual(headingIds(other))
  })

  it('reads the heading as the markdown output writes it', () => {
    const out = markdown(
      '=for head1 :masked\nSecret\n\n=head1 Masked-Z<ignored>1\n\n=head1 S<two words>\n\nL<a|#two words>',
    )
    expect(out).not.toContain('<a name="masked-1">')
    expect(out).toContain('[a](#twowords)')
  })

  it('reads a hidden word as the export masks it, with what it holds', () => {
    const out = markdown('=head1 Public G<Z<ignored>>\n\n=head1 Public\n\nSee L<jump|#Public>.')
    expect(out).toContain('[jump](#public)')
  })

  it('reads a footnote in a heading as its number', () => {
    const out = markdown('=head1 N<Footnote> title\n\nSee L<jump|#Footnote title>.')
    expect(out).toContain('# [^1] title')
    expect(out).toContain('[jump](#1-title)')
  })

  it('counts a heading the export writes for a block named in capitals', () => {
    const out = markdown('=begin NOTE\nText\n=end NOTE\n\n=head1 NOTE\n\nSee L<jump|#NOTE>.')
    expect(out).toContain('[jump](#note-1)')
  })

  it('gives a heading its own anchor when its address falls on an author id', () => {
    const out = markdown('=for head1 :id<target>\nNamed\n\n=head1 target\n\nL<first|#target> L<second|#target-2>')
    expect(out).toContain('<a name="target-2"></a>\n\n# target')
    expect(out).toContain('[first](#target) [second](#target-2)')
  })

  it('counts a hidden heading by the text the page shows in each mode', () => {
    const doc = '=for head1 :masked\nA!\n\n=head1 A?\n\nSee L<jump|#A?>.'
    expect(markdown(doc)).toContain('[jump](#a)')
    expect(markdown(doc, 'draft')).toContain('[jump](#a-1)')
  })
})
