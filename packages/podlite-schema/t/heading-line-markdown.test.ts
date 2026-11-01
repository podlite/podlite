import { podlitePluggable } from '../src/pluggableParser'
import { toMarkdown } from '../src'

// the parser of this package
const p = podlitePluggable()
const markdown = (doc: string, renderMode = 'production') =>
  String(toMarkdown({ renderMode }).run(p.toAst(p.parse(doc, { podMode: 1 }))))
const linkOf = (out: string) => (out.match(/\]\((#[^)]*)\)/) || [])[1]

describe('the line of a heading in markdown output', () => {
  it('writes a heading of two lines on one line', () => {
    expect(markdown('=head1 One\nTwo\n')).toBe('# One Two\n\n')
    expect(markdown('=TITLE One\nTwo\n')).toBe('# One Two\n\n')
    expect(markdown('=TITLE One  \nTwo\n')).toBe('# One Two\n\n')
  })

  it('keeps a line break of S<> as a tag, and a break of code as a space', () => {
    expect(markdown('=TITLE S<One\nTwo>\n')).toBe('# One<br>Two\n\n')
    expect(markdown('=TITLE S<C<One\nTwo>>\n')).toBe('# `One Two`\n\n')
  })

  it('writes a hidden part with its line break as the line of the heading wants it', () => {
    expect(markdown('=TITLE G<S<One\nTwo>>\n')).toBe('# ███ ███\n\n')
    expect(markdown('=TITLE G<S<One\nTwo>>\n', 'draft')).toBe('# One<br>Two\n\n')
    expect(markdown('=TITLE S<G<One\nTwo>>\n')).toBe('# ███<br>███\n\n')
    expect(markdown('=head1 S<G<One\nTwo>>\n')).toContain('# ███<br>███\n\n')
  })

  it('keeps a picture whole and joins the spaces around a break of every piece', () => {
    expect(markdown('=TITLE P<One\nTwo|x.png>\n')).toBe('# ![One Two](x.png)\n\n')
    expect(markdown('=head1 P<One\nTwo|x.png>\n')).toBe('# ![One Two](x.png)\n\n')
    const out = markdown('=TITLE One  E<10>  Two\n\n=head1 One Two\n\nL<#One Two>\n')
    expect(out).toContain('# One Two\n\n# One Two\n\n')
    expect(linkOf(out)).toBe('#one-two-1')
  })

  it('counts the heading of a title with the headings after it', () => {
    expect(linkOf(markdown('=TITLE One\nTwo\n\n=head1 One Two\n\nL<#One Two>\n'))).toBe('#one-two-1')
    expect(linkOf(markdown('=TITLE Note N<x>\n\n=head1 Note 1\n\nL<#Note 1>\n'))).toBe('#note-1-1')
  })

  it('numbers the notes of a title in the order of the source', () => {
    const out = markdown('=begin TITLE\n=item a N<first>\n\nPara N<second>\n=end TITLE\n')
    expect(out).toBe('# Para [^2]\n\n- a [^1]\n\n\n\n---\n\n[^1]: first\n[^2]: second\n')
  })

  it('writes a title as its heading, one heading for all its paragraphs', () => {
    expect(markdown('=TITLE test\n')).toBe('# test\n\n')
    expect(markdown('=begin TITLES\n=para One\n\n=para Two\n=end TITLES\n')).toBe('# One Two\n\n')
    expect(markdown('=begin TITLE\nOne\n\nTwo\n=end TITLE\n')).toBe('# One Two\n\n')
  })

  it('writes nothing for a title with nothing to show, and the anchor the author named', () => {
    expect(markdown('=TITLE Z<gone>\n\n=para x\n')).toBe('x\n\n')
    expect(markdown('=for TITLE :id<doc>\nZ<gone>\n\n=para x\n\nL<to|#doc>\n')).toContain('<a name="doc"></a>\n\nx\n\n')
    expect(markdown('=for TITLE :id<doc>\nName\n\nL<to|#doc>\n')).toBe('<a name="doc"></a>\n\n# Name\n\n[to](#doc)\n\n')
  })
})

describe('what stays as it was', () => {
  it('writes a heading on one line byte for byte', () => {
    expect(markdown('=head1 One \n')).toBe('# One \n\n')
    expect(markdown('=head1 One ')).toBe('# One \n')
    expect(markdown('=head1 OneE<nbsp>\n')).toBe('# One \n\n')
    expect(markdown('=TITLE E<nbsp>OneE<nbsp>\n')).toBe('# \u00a0One\u00a0\n\n')
  })

  it('writes the body of a note of a title as a note, not as a line of a heading', () => {
    expect(markdown('=TITLE Title N<S<Note\ncontinued>>\n')).toBe(
      '# Title [^1]\n\n\n\n---\n\n[^1]: Note  \ncontinued\n',
    )
  })

  it('lets an empty title take no address', () => {
    expect(linkOf(markdown('=TITLE Z<gone>\n\n=head1 !!!\n\nL<first|#!!!>\n'))).toBe('#')
    expect(linkOf(markdown('=TITLE Z<gone>\n\n=head1 Intro\n\n=head1 Intro\n\nL<#Intro>\n'))).toBe('#intro')
  })

  it('hides a paragraph of a title its own mask hides, read straight from the source', () => {
    const source = '=begin TITLE\n=for para :masked\nSecret\n=end TITLE\n'
    expect(String(toMarkdown({}).run(source))).toBe('# ██████\n\n')
    expect(String(toMarkdown({ renderMode: 'draft' }).run(source))).toBe('# Secret\n\n')
  })

  it('writes the other semantic blocks as before', () => {
    expect(markdown('=SYNOPSIS Text\n')).toBe('# SYNOPSIS\n\nText\n\n')
    expect(markdown('=NAME Name\n')).toBe('# NAME\n\nName\n\n')
  })
})
