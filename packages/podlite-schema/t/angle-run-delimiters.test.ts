import { podlitePluggable } from '../src/pluggableParser'

const render = (src: string): string => {
  const p = podlitePluggable()
  return String(p.toHtml(p.toAst(p.parse(`=para\n${src}\n`, { podMode: 1 })))).replace(/\n/g, '')
}

describe('the delimiter pairs a markup code may take', () => {
  it('accepts all four and reads the same content from each', () => {
    for (const src of ['C<a>', 'C<<a>>', 'C<<<a>>>', 'C«a»']) {
      expect(render(src)).toContain('<code>a</code>')
    }
  })

  // a bracket of the other kind is text: the code finds no bracket of its own and
  // runs to the end of the block (3374–3378, 3388–3394)
  it('does not let a pair be mixed', () => {
    expect(render('C<a»')).toContain('<code>a»</code>')
    expect(render('C«a>')).toContain('<code>a&gt;</code>')
  })

  it('reads angles inside guillemets as text', () => {
    expect(render('C«<a>»')).toContain('<code>&lt;a&gt;</code>')
  })
})

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

  // The closing run is chosen while parsing, so a longer run than the opening
  // one has to give way to the length that matches instead of swallowing it.
  it('closes on the matching length when the run is longer', () => {
    expect(render('C<<a>>>')).toContain('<code>a</code>&gt;')
    expect(render('B<a>>')).toContain('<strong>a</strong>&gt;')
  })

  // the delimiter is the whole run, of any length (3354 «multiple»)
  it('takes the whole opening run as the delimiter', () => {
    expect(render('C<<<<a>>>>')).toContain('<code>a</code>')
  })

  it('lets a code inside close on its own pair', () => {
    expect(render('C<<xB«y»z>>')).toContain('<code>xB«y»z</code>')
    expect(render('B<<I«y»>>')).toContain('<em>y</em>')
  })

  // The run that opens is the run that has to close. A code whose content cannot
  // fill the run it opened is not a code, and the text stays as written.
  // an empty body is a code with nothing in it; a run shorter than the delimiter
  // does not close it, so it runs to the end of the block (3381–3385, 3388–3394)
  it('does not fall back to a shorter opening run', () => {
    for (const src of ['C<<>>', 'C<<<>>>']) expect(render(src)).toContain('<code></code>')
    expect(render('B<<>')).toContain('<strong>&gt;</strong>')
  })
})
