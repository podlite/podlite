import { podlitePluggable } from '../src/pluggableParser'

// Unpaired angles inside one-angle delimiters are outside the norm
// (Specification.pod6:3367-3379), yet a text full of comparisons has to be read
// in a time that does not grow with every angle. The bound leaves room for a slow
// machine; the parse it guards took seconds, and over a minute for 50.
const timed = (src: string): number => {
  const p = podlitePluggable()
  const start = performance.now()
  p.toAst(p.parse(`=para\n${src}\n`, { podMode: 1 }))
  return performance.now() - start
}

describe('the time to read markup codes over unpaired angles', () => {
  const run = (n: number) => 'a < b '.repeat(n)

  it.each([
    ['outside a code', run(20)],
    ['inside B<>', `B<${run(20)}>`],
    ['inside B<<>>', `B<<${run(20)}>>`],
    ['fifty outside a code', run(50)],
  ])('stays under half a second %s', (_, src) => {
    expect(timed(src)).toBeLessThan(500)
  })
})
