import { podlitePluggable } from '../src/pluggableParser'

const render = (doc: string): string => {
  const p = podlitePluggable()
  return String(p.toHtml(p.toAst(p.parse(doc, { podMode: 1 })))).replace(/\n/g, '')
}
const renderInline = (src: string): string => render(`=para\n${src}\n`)

describe('entity escapes inside inline code', () => {
  it('reads E<> inside C<> as text when no =config allows it', () => {
    expect(renderInline('C<BE<lt>constE<gt>>')).toContain('<code>BE&lt;lt&gt;constE&lt;gt&gt;</code>')
  })

  it('resolves E<> inside C<> under =config C<> :allow<E>', () => {
    expect(render('=config C<> :allow<E>\n\n=para\nC<BE<lt>constE<gt>>\n')).toContain('<code>B&lt;const&gt;</code>')
  })

  it('leaves plain inline code unchanged', () => {
    expect(renderInline('C<plain code>')).toContain('<code>plain code</code>')
  })

  it('keeps a literal E that does not open an entity code verbatim', () => {
    expect(renderInline('C<Errors happen>')).toContain('<code>Errors happen</code>')
  })

  it('keeps a literal formatting code inside inline code verbatim', () => {
    expect(renderInline('C<B<bold>>')).toContain('<code>B&lt;bold&gt;</code>')
  })
})
