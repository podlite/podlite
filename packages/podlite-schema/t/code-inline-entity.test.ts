import { podlitePluggable } from '../src/pluggableParser'

const renderInline = (src: string): string => {
  const p = podlitePluggable()
  const html = p.toHtml(p.toAst(p.parse(`=para\n${src}\n`, { podMode: 1 })))
  return String(html).replace(/\n/g, '')
}

describe('entity escapes inside inline code', () => {
  it('resolves E<> inside C<> so angle brackets appear as literals', () => {
    expect(renderInline('C<BE<lt>constE<gt>>')).toContain('<code>B&lt;const&gt;</code>')
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
