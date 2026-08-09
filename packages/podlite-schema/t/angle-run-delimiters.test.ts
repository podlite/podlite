import { podlitePluggable } from '../src/pluggableParser'

const render = (src: string): string => {
  const p = podlitePluggable()
  return String(p.toHtml(p.toAst(p.parse(`=para\n${src}\n`, { podMode: 1 })))).replace(/\n/g, '')
}

describe('a markup code delimited by a run of angles', () => {
  it('carries a closing angle inside the content', () => {
    expect(render('C<<$foo > $bar>>')).toContain('<code>$foo &gt; $bar</code>')
  })

  it('takes a run of three', () => {
    expect(render('C<<<a > b>>>')).toContain('<code>a &gt; b</code>')
  })

  it('reads a doubled run with no spaces', () => {
    expect(render('C<<a>>')).toContain('<code>a</code>')
  })

  it('works on codes other than inline code', () => {
    expect(render('B<<bold>>')).toContain('<strong>bold</strong>')
  })

  it('keeps a nested code closing on its own angle', () => {
    expect(render('B<I<x>>')).toContain('<strong><em>x</em></strong>')
  })

  it('leaves a single-angle code as it was', () => {
    expect(render('C<:lang<js>>')).toContain('<code>:lang&lt;js&gt;</code>')
  })

  it('leaves guillemets as they were', () => {
    expect(render('C«g»')).toContain('<code>g</code>')
  })

  it('does not close on a run shorter than the opening one', () => {
    expect(render('C<< a > b >>')).toContain('a &gt; b')
  })
})
