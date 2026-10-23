import { podlitePluggable } from '../src/pluggableParser'
import { toHtml } from '../src'

// A short form of what the parser reads: a code is written NAME[content], a link
// address, synonyms and an index entry follow it in parentheses, a link
// configuration in braces, an entity as &name;. Text stays as it is.
const shape = (node: any): string => {
  if (Array.isArray(node)) return node.map(shape).join('')
  if (typeof node === 'string') return node
  if (!node || typeof node !== 'object') return ''
  if (node.type === 'text') return node.value
  if (node.type === 'html_named') return `&${node.value};`
  if (node.type === 'fcode') {
    let out = `${node.name}[${shape(node.content)}]`
    if (node.meta != null) out += `(${node.meta})`
    if (node.synonyms) out += `(${node.synonyms.join(';')})`
    if (node.entry) out += `(${node.entry.join(';')})`
    if (node.config && node.config.length) out += `{${node.config.map((c: any) => `${c.name}=${c.value}`).join(',')}}`
    return out
  }
  return shape(node.content)
}

const tree = (doc: string): any => {
  const p = podlitePluggable()
  return p.toAst(p.parse(doc, { podMode: 1 }))
}
const read = (src: string, head = ''): string => {
  const t = tree(`${head}=para\n${src}\n`)
  return shape(t.content[t.content.length - 1].content).replace(/\n$/, '')
}
const firstCode = (node: any): any => {
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = firstCode(n)
      if (found) return found
    }
    return undefined
  }
  if (!node || typeof node !== 'object') return undefined
  if (node.type === 'fcode') return node
  return firstCode(node.content)
}

// Specification.pod6: a code takes one angle, guillemets or a run of angles
// (3344-3348); a run of the same angles longer than the delimiter may not stand
// inside (3350-3359); one of the same length may, balanced (3361-3365); an
// unbalanced angle takes other delimiters or a longer run (3367-3379). An empty
// pair has the length of a one-angle delimiter and is balanced.
describe('a balanced pair of angles inside a markup code', () => {
  it.each([
    ['B<x<>y>', 'B[x<>y]'],
    ['I<x<>y>', 'I[x<>y]'],
    ['X<x<>y>', 'X[x<>y]'],
    ['A<x<>y>', 'A[x<>y]'],
    ['D<x<>y>', 'D[x<>y]'],
    ['Z<x<>y>', 'Z[x<>y]'],
    ['S<x<>y>', 'S[x<>y]'],
    ['L<x<>y>', 'L[x<>y]'],
    ['W<x<>y>', 'W[x<>y]'],
    ['F<x<>y>', 'F[x<>y]'],
    ['C<ab<>c>', 'C[ab<>c]'],
    ['C<a <> b>', 'C[a <> b]'],
    ['V<ab<>c>', 'V[ab<>c]'],
    ['B<x<foo<>bar>y>', 'B[x<foo<>bar>y]'],
    ['B«x«»y»', 'B[x«»y]'],
    ['B<I<a><>y>', 'B[I[a]<>y]'],
  ])('keeps the pair in %s', (src, expected) => {
    expect(read(src)).toBe(expected)
  })

  it.each([
    ['L<x|file:a<>b>', 'L[x](file:a<>b)'],
    ['L<file:a<>b>', 'L[file:a<>b]'],
    ["L<x|file:a<>b :title('t')>", 'L[x](file:a<>b){title=t}'],
    ['D<x|a<>b>', 'D[x](a<>b)'],
    ['X<x|a<>b>', 'X[x](a<>b)'],
    ['D«x|a«»b»', 'D[x](a«»b)'],
  ])('keeps the pair after the bar in %s', (src, expected) => {
    expect(read(src)).toBe(expected)
  })

  it('keeps the pair in V<> that a declaration lets hold codes', () => {
    expect(read('V<x<>y>', '=config V<> :allow<B>\n')).toBe('V[x<>y]')
  })

  it('reads the line of the norm that configures C<> inside a code block', () => {
    const t = tree('=begin code :allow<B>\nB<=config C<> :allow<E I>>\n=end code\n')
    expect(shape(firstCode(t))).toBe('B[=config C<> :allow<E I>]')
  })
})

describe('angles inside a code delimited by a run of angles', () => {
  it.each([
    ['C<<$foo < $bar>>', 'C[$foo < $bar]'],
    ['C<<< <<END_MARKER >>>', 'C[ <<END_MARKER ]'],
    ['C<< a < b >>', 'C[ a < b ]'],
    ['C<<< a < b >>>', 'C[ a < b ]'],
    ['B<<a <b>>', 'B[a <b]'],
    ['C<<a <b>>', 'C[a <b]'],
  ])('reads a shorter angle as text in %s', (src, expected) => {
    expect(read(src)).toBe(expected)
  })

  it.each([
    ['C<< $foo<<bar>> >>', 'C[ $foo<<bar>> ]'],
    ['C<< C<<xB«y»z>> >>', 'C[ C<<xB«y»z>> ]'],
    ['C<  $foo<bar>   >', 'C[  $foo<bar>   ]'],
    ['B<< <<x>> >>', 'B[ <<x>> ]'],
    ['B<<< a <<>> >>>', 'B[ a <<>> ]'],
    ['B<<a <>>', 'B[a <]'],
    ['C<<a <>>', 'C[a <]'],
    ['B<<< a <>>>', 'B[ a <]'],
    ['B<<a<>> b>>', 'B[a<] b>>'],
    ['B<< x <y> z >>', 'B[ x <y> z ]'],
    ['B<< x <> y >>', 'B[ x <> y ]'],
    ['B<< I<a> >>', 'B[ I[a] ]'],
    ['B<<I<a>>>', 'B[I[a]]'],
    ['C<<I<a> >>', 'C[I<a> ]'],
  ])('reads %s as before', (src, expected) => {
    expect(read(src)).toBe(expected)
  })

  // a code of two or three angles inside a code of one: the angles after the
  // inner code close it and then the outer one
  it.each([
    ['I<B<<a <x>>>', 'I[B[a <x]]'],
    ['I<B<<I«y»<x>>>', 'I[B[I[y]<x]]'],
    ['I<B<<<I«y»<x>>>>', 'I[B[I[y]<x]]'],
    ['I<B<<a <I«x»>>>', 'I[B[a <I[x]]]'],
  ])('closes an inner run before the outer code in %s', (src, expected) => {
    expect(read(src)).toBe(expected)
  })

  // the entity code takes angles only, so E«…» inside a run is text
  it('reads a run holding E«…» in C<> as text', () => {
    expect(read('C<<a <<E«lt» x>> b>>')).toBe('C[a <<E«lt» x>> b]')
  })

  it('reads a run as text in C<> where E<> does not act', () => {
    const t = tree('=begin code :allow<C>\nC<<a <<E<lt> x>> b>>\n=end code\n')
    expect(shape(firstCode(t))).toBe('C[a <<E<lt> x>> b]')
  })

  it.each([
    ['I<C<<E<lt><x>>>', 'I[C[E[&lt;]<x]]'],
    ['I<C<<<E<lt><x>>>>', 'I[C[E[&lt;]<x]]'],
  ])('closes an inner run after an entity in %s', (src, expected) => {
    expect(read(src, '=config C<> :allow<E>\n')).toBe(expected)
  })

  it('keeps a hidden word inside an inner run hidden', () => {
    for (const src of [
      'I<B<<a <G«secret»>>>',
      'I<B<<<a <G«secret»>>>>',
      'B<<x <<G«secret»>> y>>',
      'B<<<x <<<G«secret»>>> y>>>',
    ]) {
      const out = String(toHtml({ renderMode: 'production' }).run(tree(`=para\n${src}\n`)))
      expect(out).not.toContain('secret')
      expect(out).toContain('██████')
    }
  })
})

describe('delimiters of the other kind', () => {
  const production = (doc: string) => String(toHtml({ renderMode: 'production' }).run(tree(doc)))

  it('keeps a hidden code inside S«…» hidden when it holds a pair', () => {
    const out = production('=para\nS«a G«<secret>» b»\n')
    expect(out).not.toContain('secret')
    expect(out).not.toContain('»')
  })

  it('writes nothing of a comment inside Z«…» that holds a code with a pair', () => {
    const out = production('=para\nZ«G«<x>» secret»\n')
    expect(out).not.toContain('secret')
  })

  it('keeps a hidden code inside V«…» that a declaration lets hold it', () => {
    const out = production('=config V<> :allow<G>\n=para\nV«a > G<secret> c»\n')
    expect(out).not.toContain('secret')
    expect(out).toContain('██████')
  })

  it.each([
    ['B«a<b»c>', 'B[a<b]c>'],
    ['B<a«b>c»', 'B[a«b]c»'],
  ])('do not let a pair step over the closing one in %s', (src, expected) => {
    expect(read(src)).toBe(expected)
  })

  it('keeps V<> that a declaration lets hold codes', () => {
    expect(read('V<a«b>c»', '=config V<> :allow<B>\n')).toBe('V[a«b]c»')
  })

  it('reads a code inside S«…» as a code', () => {
    expect(read('S«a G<secret> b»')).toBe('S[a G[secret] b]')
  })

  // angles inside guillemets are text, so a code letter and unbalanced angles
  // inside C«…» or V«…» stay as written (3367-3372)
  it.each([
    ['C«C<<< <<END_MARKER >>>»', 'C[C<<< <<END_MARKER >>>]'],
    ['C«C<<< <x >>>»', 'C[C<<< <x >>>]'],
    ['C«C<Revenue > 100>»', 'C[C<Revenue > 100>]'],
    ['C«B<»', 'C[B<]'],
    ['V«C<<< <<E >>>»', 'V[C<<< <<E >>>]'],
    ['V«C<<< <x >>>»', 'V[C<<< <x >>>]'],
    ['V«a «b» c»', 'V[a «b» c]'],
    ['V«»', 'V[]'],
  ])('keeps the text of %s', (src, expected) => {
    expect(read(src)).toBe(expected)
  })
})

describe('text around codes', () => {
  it.each([
    ['B<x<y>z>', 'B[x<y>z]'],
    ['C<x<>y>', 'C[x<>y]'],
    ['a <> b', 'a <> b'],
    ['<>', '<>'],
    ['B<a> <> B<b>', 'B[a] <> B[b]'],
    ['B<a>><b>', 'B[a]><b>'],
    ['I<a>> b', 'I[a]> b'],
    ['B<x>y<z>', 'B[x]y<z>'],
    ['D<x|a;b>', 'D[x](a;b)'],
    ['X<x|a;b>', 'X[x](a;b)'],
    ['X<a|b,c;d>', 'X[a](b,c;d)'],
    ['L<x|https://e.test/?q=a|b>', 'L[x](https://e.test/?q=a|b)'],
    ["L<x|'file:a b'>", "L[x]('file:a b')"],
    ['L<x|file:a>', 'L[x](file:a)'],
    ['C<B<x>>', 'C[B<x>]'],
    ['E<lt>', 'E[&lt;]'],
    ['V<x>', 'V[x]'],
    ['Z<>', 'Z[]'],
    ['B<>', 'B[]'],
    ['C«$foo < $bar»', 'C[$foo < $bar]'],
  ])('reads %s as before', (src, expected) => {
    expect(read(src)).toBe(expected)
  })
})

// Input outside the norm. What it reads as is held here so that a change is seen,
// not because the reading is right.
describe('input the earlier reader read outside the norm, now read by it (plan T814)', () => {
  // the delimiter is a run of any length (3354 «multiple»); the closing run is split
  // into the closings of what is open, nearest first (decision 2.1)
  it.each([
    ['C<<<<a>>>>', 'C[a]'],
    ['B<<<<a>>>>', 'B[a]'],
    ['B<<x>>>', 'B[x]>'],
    ['B<<x<y>>>', 'B[x<y]>'],
    ['C<<x <a>>>', 'C[x <a]>'],
  ])('reads %s', (src, expected) => {
    expect(read(src)).toBe(expected)
  })

  // an angle as long as the delimiter opens a literal pair that must be balanced
  // (3368-3372); left open, the code runs to the end of its block (3388-3394)
  it.each([
    ['Z<a < b>', 'Z[a < b>\n]'],
    ['S<a < b>', 'S[a < b>\n]'],
    // the line end the unclosed link runs to is whitespace at the edge of the address (3930, 4040)
    ['L<a|x<y>', 'L[a](x<y>)'],
    ['D<a|b < c;d>', 'D[a](b < c;d>\n)'],
    ['B<a < b>', 'B[a < b>\n]'],
  ])('reads %s', (src, expected) => {
    expect(read(src)).toBe(expected)
  })

  // a pair with a code inside is closed by its own angle, and the code by the next
  it('reads B<x<I<a>>y> with the pair balanced', () => {
    expect(read('B<x<I<a>>y>')).toBe('B[x<I[a]>y]')
  })
})
