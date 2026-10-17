import { podlitePluggable } from '../src/pluggableParser'
import { readCodes } from '../src/codes/read'
import { parseFormattingCodes } from '../src/index'
import { placeInSource, lineStarts } from '../src/codes/place'

const parsed = (doc: string) => {
  const p = podlitePluggable()
  const diagnostics: any[] = []
  const tree = p.parse(doc, { diagnostics })
  const ast = p.toAst(tree)
  return {
    html: p.toHtml(ast).toString(),
    md: p.toMarkdown(ast).toString(),
    warnings: ((tree as any).diagnostics || []) as Array<{ code: string; location: any }>,
  }
}
const para = (text: string) => parsed(`=para ${text}\n`)

// Specification.pod6, release/v3.0; plan T814, decisions 2026-10-16
describe('reading markup codes by their letter', () => {
  it('keeps what G<> and Z<> hide inside a reserved code, and shows the code as written (decision 5.2, 3586, 3655–3657)', () => {
    const { html, md, warnings } = para('Q<G<hunter2>> and Y<Z<note>>')
    for (const out of [html, md]) {
      expect(out).not.toContain('hunter2')
      expect(out).not.toContain('note')
    }
    expect(html).toContain('Q&lt;')
    expect(html).toContain('Y&lt;&gt;')
    expect(md).toContain('Y<>')
    expect(warnings.map(w => w.code)).toEqual(['markup-code-reserved', 'markup-code-reserved'])
  })

  it('renders P<> as a picture with its text and address (3113–3118)', () => {
    const { html, md } = para('An P<astronaut|astronaut.png> floats.')
    expect(html).toContain('<img src="astronaut.png" alt="astronaut"/>')
    expect(md).toContain('![astronaut](astronaut.png)')
    expect(html).not.toContain('P&lt;')
  })

  it('shows the text of M<> with a module it cannot run, and warns once (4240–4244)', () => {
    const { html, md, warnings } = para('A M<hello|NoSuchModule> word.')
    for (const out of [html, md]) {
      expect(out).toContain('A hello word.')
      expect(out).not.toContain('NoSuchModule')
    }
    expect(warnings.filter(w => w.code === 'markup-code-unsupported')).toHaveLength(1)
  })

  it('formats the codes inside S<> and keeps its whitespace (4060–4063)', () => {
    const { html } = para('S<a  B<b>  c>')
    expect(html).toContain('a&nbsp;&nbsp;<strong>b</strong>&nbsp;&nbsp;c')
  })

  it('reads E<> inside C<> as text unless =config allows it', () => {
    const plain = para('C<E<lt>x>')
    expect(plain.html).toContain('<code>E&lt;lt&gt;x</code>')
    expect(plain.warnings).toEqual([])
    const configured = parsed('=config C<> :allow<E>\n\n=para C<E<lt>x>\n')
    expect(configured.html).toContain('<code>&lt;x</code>')
    expect(configured.warnings).toEqual([])
  })

  it('reads E<> inside C<> as text when =config allows other codes only', () => {
    const { html } = parsed('=config C<> :allow<I>\n\n=para C<E<lt> I<x>>\n')
    expect(html).toContain('<code>E&lt;lt&gt; <em>x</em></code>')
  })

  it('reads E<> inside C<> as text through parseFormattingCodes', () => {
    expect(parseFormattingCodes('C<E<lt>>')).toEqual([{ type: 'fcode', name: 'C', content: ['E<lt>'] }])
  })

  it('reads E<> as an entity in a code block that allows E', () => {
    expect(parsed('=begin code :allow<E>\na E<lt> b\n=end code\n').html).toContain('a &lt; b')
  })

  it('does not let the content of G<> out through a literal pair or a nested code (plan T808)', () => {
    for (const text of [
      'G<public <I<x> > secret> end.',
      'G<public <I<x>> secret> end.',
      'G«public «I«x» » secret» end.',
    ]) {
      const { html } = para(text)
      expect(html).not.toContain('secret')
      expect(html).not.toContain('public')
      expect(html).toContain('end.')
    }
  })

  it('keeps the codes a code block does not allow out of it at every depth (1362–1366, 3345–3348)', () => {
    const { html } = parsed('=begin code :allow<B V>\nB<Z<and repeatedly>>\n=end code\n')
    expect(html).toContain('<strong>Z&lt;and repeatedly&gt;</strong>')
  })
})

describe('the address of a link', () => {
  // only whitespace before a colon begins the configuration; the rest is the address as written (813–820)
  it('keeps a space at the end of the address', () => {
    expect(para('L<text| https://example.org >').html).toContain('href=" https://example.org "')
    expect(para('L<text|https://example.org :new>').html).toContain('href="https://example.org"')
  })
})

describe('where a warning about a markup code points', () => {
  it('warns about a code without its bracket in a table cell', () => {
    const { warnings } = parsed('=begin table\n  a | B<b\n  c | d\n=end table\n')
    expect(warnings.map(w => w.code)).toEqual(['markup-code-unclosed'])
  })

  it('names the line and column of the code in the source (3392)', () => {
    const { warnings } = parsed('=begin pod\n\n=for para\nSome text B<x\n\n=end pod\n')
    expect(warnings).toHaveLength(1)
    expect(warnings[0].code).toBe('markup-code-unclosed')
    expect(warnings[0].location.start).toMatchObject({ line: 4, column: 11 })
  })

  it('finds the place on a later line of an indented paragraph', () => {
    const { warnings } = parsed('=begin pod\n\n  =for para\n  first line\n  then I<open\n\n=end pod\n')
    expect(warnings).toHaveLength(1)
    expect(warnings[0].location.start).toMatchObject({ line: 5, column: 8 })
  })

  it('reports a code without its own bracket inside another once, at the inner code', () => {
    const { warnings } = para('B«x I<y » z»')
    expect(warnings.map(w => [w.code, w.location.start.column])).toEqual([['markup-code-unclosed', 11]])
  })
})

// code review, round 1 (Sol, 2026-10-16): hidden content through the new paths, cost, the norm
describe('what G<> and Z<> hide does not leave through the fields of a code', () => {
  it('keeps them out of the alternative text of P<>', () => {
    for (const out of Object.values(para('P<G<hunter2>|x.png> P<Z<note>|y.png>')).slice(0, 2) as string[]) {
      expect(out).not.toContain('hunter2')
      expect(out).not.toContain('note')
    }
  })

  it('keeps them out of an E<> it cannot read, and out of the warning', () => {
    const { html, md, warnings } = para('E<G<hunter2>> and E<Z<note>>')
    for (const out of [html, md, JSON.stringify(warnings)]) {
      expect(out).not.toContain('hunter2')
      expect(out).not.toContain('note')
    }
  })

  it('keeps them out of the address of a link', () => {
    const { html, md } = para('L<x|G<hunter2>> L<y|a/Z<note>b>')
    for (const out of [html, md]) {
      expect(out).not.toContain('hunter2')
      expect(out).not.toContain('note')
    }
  })
})

describe('the rest of round 1', () => {
  it('reads deep nesting without the JavaScript stack', () => {
    const depth = 20000
    const content: any = readCodes('B<'.repeat(depth) + 'x' + '>'.repeat(depth))
    let node = content[0]
    let levels = 1
    while (node.content && typeof node.content[0] === 'object') {
      node = node.content[0]
      levels++
    }
    expect(levels).toBe(depth)
  })

  it('places many warnings of one paragraph in time that grows with it', () => {
    const time = (k: number) => {
      const text = 'M<x|Unknown> '.repeat(k)
      const source = `=para ${text}\n`
      const issues: any[] = []
      readCodes(text, { issues })
      const fragment = { text }
      const block = { start: { offset: 0, line: 1, column: 1 }, end: { offset: source.length, line: 2, column: 1 } }
      const starts = lineStarts(source)
      const started = process.hrtime.bigint()
      for (const issue of issues) placeInSource(source, block, { fragment, start: issue.start, end: issue.end }, starts)
      return Number(process.hrtime.bigint() - started) / 1e6
    }
    // the least of five runs on inputs that take milliseconds, so a busy machine does not
    // decide; eight times the input gives eight times the time when it grows with it and
    // sixty-four when it squares, so the bound between them leaves room for a slow runner
    const least = (k: number) => Math.min(time(k), time(k), time(k), time(k), time(k))
    least(4000)
    expect(least(64000)).toBeLessThan(least(8000) * 24)
  })

  it('keeps a tab inside S<> as spaces that do not break (4060–4063)', () => {
    expect(para('S<a\tb>').html).toContain('a' + '&nbsp;'.repeat(7) + 'b')
  })

  // a specification holding spaces is quoted, and the quotes are syntax (4015)
  it('takes the quotes off a link address with a configuration (4015)', () => {
    expect(para('L<x|"/path" :new>').html).toContain('href="/path"')
  })

  it('warns about a closing bracket of the outer code inside a nested code closed by its own (decision 6.1)', () => {
    expect(para('B«x I<y » z>»').warnings.map(w => w.code)).toEqual(['markup-code-foreign-closer'])
    expect(para('B«x I<y «a» z>»').warnings).toEqual([])
  })
})

// code review, round 2 (Sol, 2026-10-16)
describe('the alternative text of P<> and the brackets left inside a nested code', () => {
  it('masks only the hidden word and leaves out a comment (3583–3586, 3655–3657)', () => {
    expect(para('P<public G<secret> suffix|x.png>').html).toContain('alt="public ██████ suffix"')
    expect(para('P<public Z<G<secret>> suffix|x.png>').html).toContain('alt="public  suffix"')
  })

  it('writes an entity in it as its character', () => {
    expect(para('P<E<lt>|x.png>').html).toContain('alt="<"')
  })

  it('reads it from deep nesting without the JavaScript stack', () => {
    const content: any = readCodes('P<' + 'B<'.repeat(5000) + 'x' + '>'.repeat(5000) + '|x.png>')
    expect(content[0].content[0].alt).toBe('x')
  })

  it('splits a closing run inside a nested code by what it closes first (decision 2.1, 6.1)', () => {
    expect(para('B<I«<x>>»tail>').warnings.map(w => w.code)).toEqual(['markup-code-foreign-closer'])
    expect(para('B<I«<x>»tail>').warnings).toEqual([])
  })
})

// code review, round 3 (Sol, 2026-10-16)
describe('what G<> and Z<> hide does not reach an address', () => {
  it('keeps them out of the source of a picture', () => {
    for (const out of Object.values(para('P<x|images/G<secret>.png> P<y|Z<note>image.png>')).slice(0, 2) as string[]) {
      expect(out).not.toContain('secret')
      expect(out).not.toContain('note')
    }
    expect(para('P<y|Z<note>image.png>').html).toContain('src="image.png"')
  })

  it('leaves the other codes of a link address as written', () => {
    expect(para('L<x|/B<part>/Z<note>>').html).toContain('href="/B<part>/"')
    expect(para('L<x|/B<G<ab>>/>').html).toContain('href="/B<██>/"')
  })
})

// code review, closing round (Astra, 2026-10-16)
describe('the closing round', () => {
  it('places the warning of each cell of a row at the cell', () => {
    const { warnings } = parsed('=begin table\nM<a|NoSuchModule> | M<b|NoSuchModule> | c\n=end table\n')
    expect(warnings.map(w => w.location.start.column)).toEqual([1, 21])
  })

  it('places a warning past a cell before it that holds the same text and says nothing', () => {
    const { warnings } = parsed('=begin table\nC<M<a|NoSuchModule>> | M<a|NoSuchModule>\n=end table\n')
    expect(warnings.map(w => w.location.start.column)).toEqual([24])
  })

  it('places the warning of a cell in the body, not in the caption of the table', () => {
    const { warnings } = parsed("=begin table :caption('M<a|NoSuchModule>')\nM<a|NoSuchModule> | x\n=end table\n")
    expect(warnings.map(w => [w.location.start.line, w.location.start.column])).toEqual([[2, 1]])
  })

  it('places the warnings of two cells with the same text ending a row at each cell', () => {
    const { warnings } = parsed('=begin table\nM<a|NoSuchModule> | M<a|NoSuchModule>\n=end table\n')
    expect(warnings.map(w => w.location.start.column)).toEqual([1, 21])
  })

  it('places the warnings of two cells with the same text at each cell', () => {
    const { warnings } = parsed('=begin table\nM<a|NoSuchModule> | M<a|NoSuchModule> | c\n=end table\n')
    expect(warnings.map(w => w.location.start.column)).toEqual([1, 21])
  })

  it('begins the configuration of a link at a line break before a colon (813–820, 3965–3967)', () => {
    const { html } = parsed('=para L<x|https://example.com\n:new>\n')
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('target="_blank"')
  })

  it('keeps the tab stops inside S<> where a code inside does not move them', () => {
    expect(para('S<aB<b>\tc>').html).toContain('a<strong>b</strong>' + '&nbsp;'.repeat(6) + 'c')
    expect(para('S<aS<b>\tc>').html).toContain('ab' + '&nbsp;'.repeat(6) + 'c')
  })
})
