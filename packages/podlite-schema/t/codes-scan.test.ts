import { scanCodes, ScanScope, CodeSpan } from '../src/codes/scan'

// A short form of the boundaries: a code is written NAME[content], text stays as it is.
// The closing delimiter is dropped, so a code cut short shows only what it holds.
export const spans = (text: string, scope: ScanScope = {}): { shape: string; unclosed: string[]; longer: number[] } => {
  const { codes, issues } = scanCodes(text, scope)
  const draw = (list: CodeSpan[], from: number, to: number): string => {
    let out = ''
    let i = from
    for (const code of list) {
      out += text.slice(i, code.start) + code.name + '[' + draw(code.children, code.bodyStart, code.bodyEnd) + ']'
      i = code.end
    }
    return out + text.slice(i, to)
  }
  return {
    shape: draw(codes, 0, text.length),
    unclosed: issues.flatMap(issue => (issue.kind === 'unclosed' ? [`${issue.code.name}@${issue.code.start}`] : [])),
    longer: issues.flatMap(issue => (issue.kind === 'longer-run' ? [issue.start] : [])),
  }
}

const reads = (text: string, shape: string, unclosed: string[] = [], scope: ScanScope = {}) => {
  const got = spans(text, scope)
  expect(got.shape).toBe(shape)
  expect(got.unclosed.map(u => u.split('@')[0])).toEqual(unclosed)
}

// Specification.pod6, release/v3.0, Markup codes 3339–3394
describe('the boundaries of markup codes, by the norm', () => {
  it('nests codes; a run closes the open things nearest first (3341–3348, decision 2.1)', () => {
    reads('B<Z<and repeatedly>>', 'B[Z[and repeatedly]]')
    reads('The B<V< V<> >> markup code', 'The B[V[ V<> ]] markup code')
    reads('B<B<B<B<x>>>>', 'B[B[B[B[x]]]]')
  })

  it('keeps the codes of a code block out at every depth (1362–1366, the example at 3345–3348)', () => {
    // Z is not allowed in the block, so Z< is text and a literal pair: >> closes the pair and B
    reads('B<Z<and repeatedly>>', 'B[Z<and repeatedly>]', [], { allowed: ['B', 'V'] })
  })

  it('balances a run as long as the delimiter (3368–3372)', () => {
    reads('C<  $foo<bar>   >', 'C[  $foo<bar>   ]')
    reads('C<< $foo<<bar>> >>', 'C[ $foo<<bar>> ]')
    reads('G<public <I<x>> secret> end.', 'G[public <I[x]> secret] end.')
  })

  it('reads a shorter run as text (3381–3385)', () => {
    reads('C«$foo < $bar»', 'C[$foo < $bar]')
    reads('C<<$foo < $bar>>', 'C[$foo < $bar]')
  })

  it('reports an opening run longer than the angle delimiter (3357–3365)', () => {
    const got = spans('C< $fooB«<<»bar >')
    expect(got.shape).toBe('C[ $fooB«<<»bar ]')
    expect(got.longer).toEqual([9])
  })

  it('balances guillemets inside guillemets (the author, 2026-10-16)', () => {
    reads('B«a «b» c»', 'B[a «b» c]')
  })

  it('keeps a nested code closed by its own bracket whole (6.1)', () => {
    reads('B«x I<y » z>»', 'B[x I[y » z]]')
  })

  it('ends a nested code without its own bracket at the bracket that closes the enclosing one (6.1, 3388–3394)', () => {
    reads('B«x I<y » z»', 'B[x I[y ]] z»', ['I'])
    reads('B<x I<<y> z', 'B[x I[y]] z', ['I'])
    reads('B«I<U<<x» tail', 'B[I[U[x]]] tail', ['I', 'U'])
    reads('B<I«U<<x»>', 'B[I[U[x]]]', ['U'])
    reads('B<I<U«x>>>', 'B[I[U[x]]]>', ['U'])
  })

  it('lets codes after the cut take effect (6.1)', () => {
    reads('B«C<<x» B«I<y» z>»', 'B[C[x]] B[I[y» z]]', ['C'])
  })

  it('counts the free brackets of a nested code without its own bracket for the enclosing one (the author, 1.2)', () => {
    reads('B«I<«x» tail', 'B[I[«x» tail]]', ['B', 'I'])
    reads('B««I<x»»', 'B[«I[x»]]', ['I'])
    reads('B<I< <U«x>>>', 'B[I[ <U[x>]]]', ['U'])
    reads('B<x <I<<y > z>', 'B[x <I[y > z]]', ['I'])
    reads('B«x «y» I<z»» w', 'B[x «y» I[z]]» w', ['I'])
  })

  it('runs a code without its bracket to the end of the fragment and warns (3388–3394)', () => {
    reads('B<x', 'B[x]', ['B'])
    reads('a B<b I<c', 'a B[b I[c]]', ['B', 'I'])
  })

  it('leaves the rest of a closing run as text', () => {
    reads('C<x>> y', 'C[x]> y')
  })

  it('opens a code at a capital letter right before a bracket, with no word boundary', () => {
    reads('aB<x>', 'aB[x]')
    reads('a < b > c', 'a < b > c')
  })
})

describe('codes inside C<> and V<>', () => {
  it('reads no code inside C<> without =config (3515–3527, decision 4.1)', () => {
    reads('C<BE<lt>constE<gt>>', 'C[BE<lt>constE<gt>]')
  })

  it('reads the codes =config allows inside C<>', () => {
    reads('C<BE<lt>constE<gt>>', 'C[BE[lt]constE[gt]]', [], { allowedIn: { C: ['E'] } })
  })

  it('reads E<> inside C<> in the transition release, inside the codes of the block only', () => {
    reads('C<E<lt> I<x>>', 'C[E[lt] I<x>]', [], { entityInCode: true })
    reads('C<E<lt> I<x>>', 'C[E[lt] I[x]]', [], { entityInCode: true, allowedIn: { C: ['I'] } })
    reads('C<E<lt>>', 'C[E<lt>]', [], { entityInCode: true, allowed: ['C'] })
    // inside a literal pair of C<> the earlier reader left E<…> as written, and so does the transition
    reads('C<G<E<32>>>', 'C[G<E<32>>]', [], { entityInCode: true })
    reads('C«G<E<32>> E<lt>»', 'C[G<E<32>> E[lt]]', [], { entityInCode: true })
  })

  it('reads nothing inside V<>', () => {
    reads('V<B<x>>', 'V[B<x>]')
  })
})

describe('the cost of finding boundaries', () => {
  const steps = (text: string): number => {
    const started = process.hrtime.bigint()
    scanCodes(text)
    return Number(process.hrtime.bigint() - started) / 1e6
  }

  it('reads deep nesting without the JavaScript stack', () => {
    const depth = 100000
    const got = scanCodes('B<'.repeat(depth) + 'x' + '>'.repeat(depth))
    expect(got.issues).toEqual([])
    let code = got.codes[0]
    let levels = 1
    while (code.children.length) {
      code = code.children[0]
      levels++
    }
    expect(levels).toBe(depth)
  })

  it('stays fast on the inputs of T806 and on closed nesting', () => {
    for (const text of ['a < b '.repeat(2000), '<'.repeat(4000), 'B<'.repeat(2000) + 'x' + '>'.repeat(2000)]) {
      expect(steps(text)).toBeLessThan(100)
    }
  })
})
