import { podlitePluggable } from '../src/pluggableParser'

// The tasks T814 took in, each by its own condition (PODLITE-PLAN, T805, T744, T806)
const parsed = (doc: string) => {
  const p = podlitePluggable()
  const ast = p.toAst(p.parse(doc))
  return { ast, html: p.toHtml(ast).toString() }
}
const shape = (node: any): string => {
  if (Array.isArray(node)) return node.map(shape).join('')
  if (typeof node === 'string') return node
  if (!node || typeof node !== 'object') return ''
  if (node.type === 'text') return node.value
  if (node.type === 'fcode') {
    let out = `${node.name}[${shape(node.content)}]`
    if (node.meta != null) out += `(${node.meta})`
    if (node.synonyms) out += `(${node.synonyms.join(';')})`
    if (node.entry) out += `(${node.entry.join(';')})`
    return out
  }
  return shape(node.content)
}
const read = (text: string) => shape(parsed(`=para ${text}\n`).ast).trim()

describe('T805: the codes with rules of their own take doubled and tripled delimiters', () => {
  const bodies: Record<string, string> = { L: 't|u', W: 't|u', X: 't|a;b', D: 't|a;b' }
  for (const code of ['S', 'Z', 'V', 'L', 'X', 'D', 'W', 'A']) {
    it(`reads ${code} the same with one, two and three angles and with guillemets`, () => {
      const body = bodies[code] || 'x <y> z'
      const one = read(`${code}<${body}>`)
      expect(read(`${code}«${body}»`)).toBe(one)
      // a run as long as the delimiter inside stays balanced
      expect(read(`${code}<<${body.replace('<y>', '<<y>>')}>>`)).toBe(one.replace('<y>', '<<y>>'))
      expect(read(`${code}<<<${body.replace('<y>', '<<<y>>>')}>>>`)).toBe(one.replace('<y>', '<<<y>>>'))
    })
  }
})

describe('T744: S<> reads the codes inside it', () => {
  it('holds a nested code and keeps the spaces around it', () => {
    expect(read('S<x B<b> y>')).toBe('S[x B[b] y]')
    expect(parsed('=para S<x  B<b>  y>\n').html).toContain('x&nbsp;&nbsp;<strong>b</strong>&nbsp;&nbsp;y')
  })

  // Specification.pod6, Space-preserving text: the example and how it is formatted
  it('formats the example of the norm', () => {
    const { html } = parsed('=para The emergency signal is: S<\ndot dot dot   dash dash dash   dot dot dot>.\n')
    expect(html).toContain(
      'The emergency signal is: <br>dot&nbsp;dot&nbsp;dot&nbsp;&nbsp;&nbsp;dash&nbsp;dash&nbsp;dash&nbsp;&nbsp;&nbsp;dot&nbsp;dot&nbsp;dot.',
    )
  })
})

describe('T806: thousands of unpaired angles parse in time that grows with the text', () => {
  const ms = (doc: string) => {
    const started = process.hrtime.bigint()
    parsed(doc)
    return Number(process.hrtime.bigint() - started) / 1e6
  }
  it('reads them outside a code, inside B<> and in a row, well under 100 ms', () => {
    for (const doc of ['a < b '.repeat(2000), `B<${'a < b '.repeat(2000)}>`, '<'.repeat(500)])
      expect(ms(`=para ${doc}\n`)).toBeLessThan(100)
  })
  it('grows no faster than the text', () => {
    const least = (k: number) => Math.min(...[0, 1, 2].map(() => ms(`=para B<${'a < b '.repeat(k)}>\n`)))
    least(500)
    expect(least(4000)).toBeLessThan(least(1000) * 8)
  })
})
