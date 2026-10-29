import { indexAnchors, readerAnchors, toHtml, toMarkdown } from '../src'
import { podlite } from '../../core/src'
import Writer from '../src/writer'

type Mode = 'production' | 'draft'

const p = podlite({ importPlugins: true })
const tree = (body: string) => p.toAst(p.parse(`=begin pod\n\n${body}\n\n=end pod\n`, { podMode: 1 }))
const markdown = (body: string, mode: Mode = 'production') => String(toMarkdown({ renderMode: mode }).run(tree(body)))
const html = (body: string) => String(toHtml({ renderMode: 'production' }).run(tree(body))).replace(/\n/g, '')
const headingIds = (out: string) => [...out.matchAll(/<h\d id="([^"]*)"/g)].map(m => m[1])

const firstHeading = (node: unknown): object | undefined => {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = firstHeading(child)
      if (found) return found
    }
    return undefined
  }
  if (!node || typeof node !== 'object') return undefined
  const n = node as { type?: string; name?: string; content?: unknown }
  if (n.type === 'block' && n.name === 'head') return n
  return firstHeading(n.content)
}

const allowE = '=config C<> :allow<E>\n\n'

describe('entities in markdown output', () => {
  it('writes the characters of named and numbered entities', () => {
    expect(markdown('=para\nA E<lt> B E<copy> C E<65> D')).toContain('A \\< B © C A D')
    expect(markdown('=para\nE<171;0xBB;hellip>')).toContain('«»…')
  })

  it('writes a markdown sign from an entity as the same sign typed as text', () => {
    expect(markdown('=para\nE<ast>x E<verbar> y')).toContain('\\*x \\| y')
    expect(markdown('=para\n*x | y')).toContain('\\*x \\| y')
  })

  it('writes a less-than sign and an ampersand from an entity as typed text writes them', () => {
    expect(markdown('=para\nE<lt>b>')).toContain('\\<b>')
    expect(markdown('=para\nE<amp>copy;')).toContain('\\&copy;')
  })

  it('keeps a bar from an entity inside code in a table cell', () => {
    expect(markdown(`${allowE}=table\nC<a E<verbar> b> | Desc`)).toContain('| `a \\| b` | Desc |')
  })

  it('writes entities inside code allowed to read them', () => {
    expect(markdown(`${allowE}=para\nC<E<lt>>`)).toContain('`<`')
    expect(markdown(`${allowE}=para\nC<BE<lt>constE<gt>>`)).toContain('`B<const>`')
  })

  it('keeps an entity inside code as written when code does not read it', () => {
    expect(markdown('=para\nC<a E<verbar> b>')).toContain('`a E<verbar> b`')
  })

  it('keeps a space from an entity inside S<> unbreakable', () => {
    expect(markdown('=para\nS<aE<32>b>')).toContain('a&nbsp;b')
  })

  it('writes a code point beyond the basic plane', () => {
    expect(markdown('=para\nE<0x1F600>')).toContain('\u{1F600}')
  })

  it('writes nothing for a number that is not a code point', () => {
    expect(markdown('=para\nxE<0x110000>y')).toContain('xy')
    expect(markdown('=para\nxE<0o9>y')).toContain('xy')
  })
})

describe('hidden entities in markdown output', () => {
  it('masks an entity in a masked block and shows it in draft', () => {
    const doc = '=for para :masked\nA E<lt> B'
    expect(markdown(doc)).toContain('█ █ █')
    expect(markdown(doc)).not.toContain('<')
    expect(markdown(doc, 'draft')).toContain('A \\< B')
  })

  it('shows an entity hidden by G<> in draft', () => {
    expect(markdown('=para\nG<E<lt>x>', 'draft')).toContain('\\<x')
  })

  it('masks G<> holding an entity in production', () => {
    const out = markdown('=para\nG<E<lt>x>')
    expect(out).toContain('█')
    expect(out).not.toContain('<')
    expect(out).not.toContain('x')
  })

  it('masks the characters of an entity in a masked heading and keeps its address', () => {
    const out = markdown('=for head1 :masked\nE<109;97;115;107;101;100;45;49>')
    expect(out).toContain('# ████████')
    expect(out).toContain('<a name="masked-1"></a>')
  })
})

describe('heading addresses with entities', () => {
  const readerAddress = (body: string) => {
    const doc = tree(body)
    const heading = firstHeading(doc)
    return heading ? readerAnchors(indexAnchors(doc))?.byNode.get(heading) : undefined
  }

  it('builds the markdown address from the characters of an entity', () => {
    expect(markdown('=head1 A E<65> B')).toContain('# A A B')
    expect(readerAddress('=head1 A E<65> B')).toBe('a-a-b')
  })

  it('leaves the address of a heading without entities alone', () => {
    expect(readerAddress('=head1 A B')).toBe('a-b')
  })

  it('names hidden headings by the characters their entities give', () => {
    expect(headingIds(html('=head1 G<E<0x10020>>\n\n=head1 G<x>'))).toEqual(['masked-1', 'masked-2'])
    expect(headingIds(html('=head1 G<E<0x110000>>\n\n=head1 G<x>'))).toEqual(['masked-1'])
  })
})

describe('text a markdown reader would take for markup', () => {
  const adjust = 'E<lt>Adjust as appropriate for the specific auditE<gt>'

  it('keeps an angle bracket from an entity from opening a tag', () => {
    expect(markdown(`=head1 Definitions ${adjust}`)).toContain(
      '# Definitions \\<Adjust as appropriate for the specific audit>',
    )
    expect(markdown(`=para\nSee ${adjust} here`)).toContain('See \\<Adjust as appropriate for the specific audit> here')
    expect(markdown(`=table\nTerm | ${adjust}`)).toContain(
      '| Term | \\<Adjust as appropriate for the specific audit> |',
    )
    expect(markdown(`=para\nNoteN<note with ${adjust}>`)).toContain(
      '[^1]: note with \\<Adjust as appropriate for the specific audit>',
    )
  })

  it('keeps typed angle brackets and ampersands as text', () => {
    expect(markdown('=para\na <b> c &copy; d')).toContain('a \\<b> c \\&copy; d')
    expect(markdown('=para\na < b, R&D, x <= y')).toContain('a \\< b, R&D, x \\<= y')
    expect(markdown('=para\n<Z<>Audit Title>')).toContain('\\<Audit Title>')
    expect(markdown('=para\nmail <1@example.org>')).toContain('mail \\<1@example.org>')
    expect(markdown('=para\nA<Audit Title>')).toContain('A\\<Audit Title>')
    expect(markdown('=para\nhttps://example.org/?a=1&b=2')).toContain('https://example.org/?a=1&b=2')
  })

  it('keeps an angle bracket in a table caption written as a string', () => {
    expect(markdown("=begin table :caption('Definitions <Adjust audit>')\na | b\n=end table")).toContain(
      '**Definitions \\<Adjust audit>**',
    )
  })

  it('writes text in a table of merged cells as markdown text', () => {
    const merged = (cell: string) =>
      `${allowE}=begin table\n=begin row\n=for cell :colspan<2>\n${cell}\n=end row\n=end table`
    expect(markdown(merged(adjust))).toContain('<td colspan="2">\n\n\\<Adjust as appropriate for the specific audit>')
    expect(markdown(merged('C<E<lt>Audit TitleE<gt>>'))).toContain('`<Audit Title>`')
    const block =
      '=begin table\n=begin row\n=begin cell :colspan<2>\n=begin code\n<Audit Title>\n=end code\n=end cell\n=end row\n=end table'
    expect(markdown(block)).toContain('```\n<Audit Title>\n```')
  })

  it('makes the fence of inline code longer than a backtick inside it', () => {
    expect(markdown(`${allowE}=para\nC<a E<96> E<lt>Audit TitleE<gt>>`)).toContain('``a \\` <Audit Title>``')
  })

  it('writes angle brackets in code as they stand', () => {
    expect(markdown('=para\nC«a<b»')).toContain('`a<b`')
    expect(markdown('=begin code\n<tag> & more\n=end code')).toContain('```\n<tag> & more\n```')
  })
})

describe('a writer given by the caller', () => {
  it('writes code with a plain writer', () => {
    const out: string[] = []
    toMarkdown({ writer: new Writer((str: string) => out.push(str)) }).run(
      tree('=begin code\n<x> & y\n=end code\n\n=para C<a>'),
    )
    expect(out.join('')).toContain('<x> & y')
    expect(out.join('')).toContain('`a`')
  })
})
