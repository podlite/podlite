import { podlitePluggable } from '../src/pluggableParser'

const render = (src: string): string => {
  const p = podlitePluggable()
  return String(p.toHtml(p.toAst(p.parse(src, { podMode: 1 })))).replace(/\n/g, '')
}

const configured = (declaration: string, body: string) => render(`${declaration}\n\n=para\n${body}\n`)

describe('=config on an inline code', () => {
  it('lets a declared code act inside C<>', () => {
    expect(configured('=config C<> :allow<I>', 'C<code I<italic>>')).toContain('<code>code <em>italic</em></code>')
  })

  it('acts whatever delimiters the code is written in', () => {
    expect(configured('=config C<> :allow<I>', 'C<<code I<italic>>>')).toContain('<code>code <em>italic</em></code>')
    expect(configured('=config C<> :allow<I>', 'C«code I<italic>»')).toContain('<code>code <em>italic</em></code>')
  })

  it('lets an entity act inside V<>', () => {
    expect(configured('=config V<> :allow<E>', 'V<verbatim E<lt>>')).toContain('verbatim &lt;')
  })

  it('keeps a code verbatim when nothing is declared', () => {
    expect(render('=para\nC<code I<italic>>\n')).toContain('<code>code I&lt;italic&gt;</code>')
    expect(render('=para\nV<verbatim E<lt>>\n')).toContain('verbatim E&lt;lt&gt;')
  })

  it('names one code only, leaving the others verbatim', () => {
    expect(configured('=config C<> :allow<I>', 'C<code B<bold>>')).toContain('<code>code B&lt;bold&gt;</code>')
  })

  it('acts from where it is written', () => {
    const html = render('=para\nC<before I<one>>\n\n=config C<> :allow<I>\n\n=para\nC<after I<two>>\n')
    expect(html).toContain('<code>before I&lt;one&gt;</code>')
    expect(html).toContain('<code>after <em>two</em></code>')
  })

  it('keeps the allowed codes when a later declaration sets another option', () => {
    expect(configured("=config C<> :allow<I>\n\n=config C<> :title('x')", 'C<code I<italic>>')).toContain(
      '<code>code <em>italic</em></code>',
    )
  })

  it('takes the codes allowed where the text is placed', () => {
    const p = podlitePluggable()
    const config = { 'C<>': [{ name: 'allow', value: 'I', type: 'string' as const }] }
    const html = String(p.toHtml(p.toAst(p.parse('=para\nC<code I<italic>>\n', { podMode: 1, config }), { config })))
    expect(html).toContain('<code>code <em>italic</em></code>')
  })

  it('holds the declaration to the block it is written in', () => {
    const html = render(
      '=begin pod\n=config C<> :allow<I>\n\n=para\nC<in I<here>>\n=end pod\n\n=para\nC<out I<there>>\n',
    )
    expect(html).toContain('<code>in <em>here</em></code>')
    expect(html).toContain('<code>out I&lt;there&gt;</code>')
  })
})
