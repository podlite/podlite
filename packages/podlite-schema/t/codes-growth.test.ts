import { podlitePluggable } from '../src/pluggableParser'
import groupItems from '../src/plugin-group-items'

describe('a paragraph with thousands of markup codes', () => {
  const parser = podlitePluggable()
  const text = (codes: number) => `=para ${'B<x> '.repeat(codes)}\n`
  const time = (run: () => unknown) => {
    const started = process.hrtime.bigint()
    run()
    return Number(process.hrtime.bigint() - started) / 1e6
  }
  // the least of seven runs, sizes taken in turn after a warm-up; the text grows eight times,
  // linear time stays near 8, square time is over 50
  const growth = (stage: (doc: string) => () => unknown) => {
    const small = stage(text(2000))
    const large = stage(text(16000))
    for (let i = 0; i < 3; i++) small(), large()
    const times: { small: number[]; large: number[] } = { small: [], large: [] }
    for (let i = 0; i < 7; i++) {
      times.small.push(time(small))
      times.large.push(time(large))
    }
    return Math.min(...times.large) / Math.min(...times.small)
  }

  it('is parsed in time that grows with the text', () => {
    expect(growth(doc => () => parser.parse(doc, { podMode: 1 }))).toBeLessThan(30)
  })

  it('is made into a document in time that grows with the text', () => {
    expect(
      growth(doc => {
        const tree = parser.parse(doc, { podMode: 1 })
        return () => parser.toAst(tree)
      }),
    ).toBeLessThan(30)
  })
})

describe('a list with thousands of items at one level', () => {
  const items = (count: number) =>
    Array.from({ length: count }, () => ({ type: 'block', name: 'item', level: 1, content: [] }))
  const time = (run: () => unknown) => {
    const started = process.hrtime.bigint()
    run()
    return Number(process.hrtime.bigint() - started) / 1e6
  }

  // grouping changes the tree it is given, so every run takes a tree built before the clock starts
  it('is grouped in time that grows with the list', () => {
    const runs = 10
    const small = Array.from({ length: runs }, () => items(2000))
    const large = Array.from({ length: runs }, () => items(16000))
    const times: { small: number[]; large: number[] } = { small: [], large: [] }
    for (let i = 0; i < runs; i++) {
      const s = time(() => groupItems()(small[i]))
      const l = time(() => groupItems()(large[i]))
      if (i >= 3) times.small.push(s), times.large.push(l)
    }
    expect(Math.min(...times.large) / Math.min(...times.small)).toBeLessThan(30)
  })
})
