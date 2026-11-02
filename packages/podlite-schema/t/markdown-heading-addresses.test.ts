import { execFileSync } from 'child_process'
import * as path from 'path'
import { podlite } from '../../core/src'
import { toMarkdown, toAnyRules } from '../src'
import { textOfTokens } from '../src/markdown-heading-text'
import WriterMarkdown from '../src/writerMarkdown'

// the path of the command line: the core with its plugins
const core = podlite({ importPlugins: true })
const markdown = (doc: string, renderMode = 'production') =>
  String(
    toMarkdown({ renderMode })
      .use(toAnyRules('toMarkdown', core.getPlugins()))
      .run(core.toAst(core.parse(doc, { podMode: 1 }))),
  )
// for each link to a place of the document, the heading each reader takes it to (its number)
const targetsByBoth = (docs: string[]) =>
  JSON.parse(
    execFileSync('node', [path.join(__dirname, 'reference-readers.mjs')], {
      input: JSON.stringify({ texts: docs.map(doc => markdown(doc)), headings: true }),
      cwd: path.join(__dirname, '../../..'),
      encoding: 'utf8',
    }),
  )
// every link reaches the heading wanted, and no address of the page is given twice
const expectTargets = (docs: string[], wanted: number[][]) =>
  targetsByBoth(docs).forEach((read: { marked: number[]; remark: number[]; repeated: string[] }, at: number) => {
    expect(read.marked).toEqual(wanted[at])
    expect(read.remark).toEqual(wanted[at])
    expect(read.repeated).toEqual([])
  })
// a warning the output gives while it writes a document
const warningsOf = (doc: string): string[] => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    markdown(doc)
    return warn.mock.calls.map(call => String(call[0]))
  } finally {
    warn.mockRestore()
  }
}

describe('a link to a heading in markdown output, followed by two readers', () => {
  it('reaches the heading the author named, whatever the text the output wrote for the headings', () => {
    expectTargets(
      [
        '=alias APP Axona\n\n=head1 About A<APP>\n\n=head1 About Axona\n\nL<see|#About Axona>\n',
        '=config C<> :allow<L>\n\n=head1 Use C<L<docs|https://example.com>>\n\n=head1 Use docs\n\nL<see|#Use docs>\n',
        '=TITLE S< >\n\n=head1 !!!\n\n=head1 ???\n\nL<second|#???>\n',
        '=begin comment\n=head1 Hidden\n=end comment\n\n=head1 Intro\n\n=head1 Intro\n\nL<second|#Intro-2>\n',
        '=head1 P<cap|x.png>\n\n=head1 cap\n\nL<see|#cap>\n',
        '=alias NOTE N<note>\n\n=head1 Name A<NOTE>\n\n=head1 Name 1\n\nL<see|#Name 1>\n',
        '=head1 Before C< one > after\n\n=head1 Before one after\n\nL<see|#Before one after>\n',
        '=head1 P<|x.png>\n\n=head1 x\n\nL<see|#x>\n',
      ],
      [[1], [0], [2], [1], [1], [1], [1], [1]],
    )
  })

  it('moves a named anchor off the address a reader builds for another heading', () => {
    expectTargets(['=TITLE x\n\n=for head1 :id<x>\nNamed\n\nL<named|#x>\n'], [[1]])
  })

  it('names a heading whose code holds a link to this document, and the heading it links to', () => {
    const doc =
      '=config C<> :allow<L>\n\n=head1 Target\n\n=head1 Go C<L<there|#Target>>\n\n=head1 Target\n\nL<back|#Target>\n'
    const out = markdown(doc)
    expect(out).toContain('# Go `[there](#target)`')
    expectTargets([doc], [[0]])
  })

  it('writes no anchor for the address a reader builds for the very heading it names', () => {
    const doc = '=config C<> :allow<L>\n\n=head1 Target\n\n=head1 Go C<L<there|#Target>>\n\nL<back|#Target>\n'
    expect(markdown(doc)).not.toContain('<a name="target">')
    expectTargets([doc, '=for TITLE :id<x>\nx\n\n=head1 Other\n\nL<see|#x>\n'], [[0], [0]])
  })

  it('follows a link inside a heading', () => {
    expectTargets(['=head1 L<go|#Target>\n\n=head1 Target\n\nL<see|#Target>\n'], [[1, 1]])
  })
})

describe('the cases where the line of a heading depends on the addresses', () => {
  it('keeps a named anchor whose address a heading line holds in code off the addresses after the move', () => {
    const doc =
      '=config C<> :allow<L>\n\n=TITLE x\n\n=for head1 :id<x>\nOther\n\n=head1 Use C<L<go|#x>>\n\n=for head1 :id<use-gox-2>\nFinal\n\nL<jump|#use-gox-2>\n'
    expectTargets([doc], [[3]])
  })

  it('counts a heading an alias brings and follows a link an alias brings into code', () => {
    expectTargets(
      [
        '=alias APP Axona\n\n=alias REF L<go|#About APP>\n\n=config C<> :allow<A>\n\n=head1 Use C<A<REF>>\n\n=head1 About A<APP>\n\nL<see|#Use REF>\n',
        '=alias H =head1 Same\n\nA<H>\n\n=head1 Same\n\nL<see|#Same>\n',
      ],
      [[0], [1]],
    )
  })

  it('keeps the named anchor of a title off the address of another heading', () => {
    expectTargets(['=for TITLE :id<x>\nOther\n\n=head1 x\n\nL<title|#x>\n'], [[0]])
  })

  it('does not count a line of more than six signs as a heading', () => {
    expectTargets(['=head7 A\n\n=head1 A\n\n=head1 A-1\n\nL<see|#A-1>\n'], [[1]])
  })

  it('settles a chain of headings whose code links to the next one, without a warning', () => {
    // each named id meets the address a reader builds for the heading before it
    const doc = [
      '=config C<> :allow<L>',
      '=TITLE x',
      '=for head1 :id<x>\nOther',
      '=head1 C<L<a|#x>>',
      '=for head1 :id<ax-2>\nN1',
      '=head1 C<L<b|#ax-2>>',
      '=for head1 :id<bax-2-2>\nN2',
      '=head1 C<L<c|#bax-2-2>>',
      '=for head1 :id<cbax-2-2-2>\nN3',
      '=head1 C<L<d|#cbax-2-2-2>>',
      '=for head1 :id<dcbax-2-2-2-2>\nN4',
      'L<last|#dcbax-2-2-2-2>',
    ].join('\n\n')
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expectTargets([doc], [[9]])
      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  it('settles a heading an alias brings with a link in its code', () => {
    const doc =
      '=alias H =config C<> :allow<L>\n=        =head1 C<L<go|#Target>>\n\nA<H>\n\n=head1 Target\n\nL<see|#Target>\n'
    expect(warningsOf(doc)).toEqual([])
    expectTargets([doc], [[1]])
  })

  it('ends and warns once where two headings hold links to each other in code', () => {
    // the address a reader builds for each line is the address of the other heading, so a
    // number moves both and they meet again: a limit, told out loud
    const doc = '=config C<> :allow<L>\n\n=for head1 :id<x>\nC<L<!|#y>>\n\n=for head1 :id<y>\nC<L<?|#x>>\n\nL<see|#x>\n'
    expect(warningsOf(doc).filter(text => text.includes('do not settle'))).toHaveLength(1)
  })

  it('writes the named anchor of a block named in capitals the author gave an id', () => {
    expectTargets(['=for DESCRIPTION :id<x>\nBody\n\n=head1 x\n\nL<see|#x>\n'], [[0]])
  })

  it('counts a footnote in a heading as its number', () => {
    expectTargets(['=head1 Name N<note>\n\n=head1 Name 1\n\nL<see|#Name 1>\n'], [[1]])
  })

  it('reads the lines aside with the markdown writer the caller gives', () => {
    class Renaming extends WriterMarkdown {
      escape(text: string) {
        return super.escape(String(text).replace(/Alpha/g, 'Beta'))
      }
    }
    const tree = core.toAst(core.parse('=head1 Alpha\n\n=head1 Beta\n\nL<see|#Beta>\n', { podMode: 1 }))
    const out = String(toMarkdown({ writer: Renaming }).use(toAnyRules('toMarkdown', core.getPlugins())).run(tree))
    expect(out).toContain('[see](#beta-1)')
  })

  it('counts a title before the headings of the blocks it holds', () => {
    expectTargets(['=begin TITLE\nName\n\n=head1 Name\n=end TITLE\n\nL<inner|#Name>\n'], [[1]])
  })
})

describe('what stays as it was', () => {
  it('writes the same output twice from one tree', () => {
    const tree = core.toAst(core.parse('=head1 A\n\n=head1 A\n\nL<#A> L<#A-2>\n', { podMode: 1 }))
    const run = () => String(toMarkdown({}).use(toAnyRules('toMarkdown', core.getPlugins())).run(tree))
    expect(run()).toBe(run())
  })

  it('gives plain headings the addresses they had', () => {
    expect(markdown('=head1 Install\n\n=head1 Install\n\nL<second|#Install-2>\n')).toContain('[second](#install-1)')
  })

  it('fails out loud on a piece of a heading it cannot read', () => {
    expect(() => textOfTokens([{ type: 'unknown-piece' } as any])).toThrow(/unknown-piece/)
  })

  it('warns of an alias that expands into itself once, not once for each walk', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      markdown('=alias LOOP A<LOOP>\n\n=head1 A<LOOP>\n')
      expect(warn.mock.calls.filter(call => String(call[0]).includes('expands into itself'))).toHaveLength(1)
    } finally {
      warn.mockRestore()
    }
  })
})
