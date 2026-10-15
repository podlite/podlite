import { podlitePluggable } from '../src/pluggableParser'

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

  it('reads E<> inside C<> in this release and warns that =config is needed (decision 4.1)', () => {
    const plain = para('C<E<lt>x>')
    expect(plain.html).toContain('<code>&lt;x</code>')
    expect(plain.warnings.map(w => w.code)).toEqual(['markup-code-entity-in-code'])
    const configured = parsed('=config C<> :allow<E>\n\n=para C<E<lt>x>\n')
    expect(configured.html).toContain('<code>&lt;x</code>')
    expect(configured.warnings).toEqual([])
  })

  it('does not let the content of G<> out through a literal pair or a nested code (plan T808)', () => {
    for (const text of ['G<public <I<x> > secret> end.', 'G<public <I<x>> secret> end.', 'G«public «I«x» » secret» end.']) {
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

describe('where a warning about a markup code points', () => {
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
