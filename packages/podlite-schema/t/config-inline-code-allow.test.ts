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

describe('a code allowed inside C<> or V<> acts at any depth', () => {
  const inline = (html: string) => html.replace(/<\/?(div|p)[^>]*>/g, '').trim()

  it.each<[string, string, string]>([
    ['=config C<> :allow<I>', 'C<I<E<lt>>>', '<code><em>E&lt;lt&gt;</em></code>'],
    ['=config C<> :allow<I>', 'C<I<B<x>>>', '<code><em>B&lt;x&gt;</em></code>'],
    ['=config V<> :allow<I>', 'V<I<E<lt>>>', '<em>E&lt;lt&gt;</em>'],
    ['=config C<> :allow<I>', 'C<I<I<E<lt>>>>', '<code><em><em>E&lt;lt&gt;</em></em></code>'],
    ['=config C<> :allow<V I>\n=config V<> :allow<I E>', 'C<V<I<E<lt>>>>', '<code><em>E&lt;lt&gt;</em></code>'],
    ['=config V<> :allow<C I>\n=config C<> :allow<I E>', 'V<C<I<E<lt>>>>', '<code><em>E&lt;lt&gt;</em></code>'],
  ])('keeps a code the outer C<> or V<> does not allow: %s, %s', (declaration, body, html) => {
    expect(inline(configured(declaration, body))).toBe(html)
  })

  it.each<[string, string, string]>([
    ['=config C<> :allow<V E>\n=config V<> :allow<E>', 'C<V<E<lt>>>', '<code>&lt;</code>'],
    ['=config C<> :allow<>', 'C<I<x>>', '<code>I&lt;x&gt;</code>'],
    ['=config V<> :allow<>', 'V<I<x>>', 'I&lt;x&gt;'],
    ['=config C<> :allow<I>\n=config C<> :allow<>', 'C<I<x>>', '<code>I&lt;x&gt;</code>'],
    ['=config C<> :allow<E I>', 'C<%hashI<E<laquo>>keyI<E<raquo>>>', '<code>%hash<em>«</em>key<em>»</em></code>'],
    ['=config C<> :allow<I>', 'C«I<x» I<E<lt>>', '<code><em>x</em></code> <em>&lt;</em>'],
  ])('acts as the lists of every C<> and V<> around it allow: %s, %s', (declaration, body, html) => {
    expect(inline(configured(declaration, body))).toBe(html)
  })

  it('keeps a code the C<> list does not allow inside a code block that allows it', () => {
    const html = render('=config C<> :allow<I>\n\n=begin code :allow<C I E>\nC<I<E<lt>>>\n=end code\n')
    expect(html).toContain('<code><em>E&lt;lt&gt;</em></code>')
  })
})
