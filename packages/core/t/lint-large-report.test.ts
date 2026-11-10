import type { Violation } from '../src/lint/types'

// what the rules over the tree return; when unset, the real rules run
let fromRules: Violation[] | null = null

jest.mock('../src/lint/engine', () => {
  const actual = jest.requireActual('../src/lint/engine')
  return {
    ...actual,
    runRules: (...args: Parameters<typeof actual.runRules>) => fromRules ?? actual.runRules(...args),
  }
})

import { lintSource } from '../src/lint/index'

const many = (n: number, at?: number): Violation[] =>
  Array.from({ length: n }, (_, i) => ({
    rule: 'x-many',
    severity: 'warning' as const,
    message: String(i),
    ...(at === undefined
      ? {}
      : { location: { start: { offset: at, line: 1, column: 1 }, end: { offset: at, line: 1, column: 1 } } }),
  }))

afterEach(() => {
  fromRules = null
})

describe('a report too large to pass as arguments', () => {
  it('keeps every message of the rules in order', () => {
    fromRules = many(200_000)
    const { violations } = lintSource('=pod\n\nText.\n', 'big.podlite', {})
    expect(violations.some(v => v.rule === 'syntax-valid')).toBe(false)
    expect(violations.map(v => v.message)).toEqual(fromRules.map(v => v.message))
  })

  it('silences the messages inside a block that mutes them and keeps the rest', () => {
    const src = '=for para :lint-ignore<x-many>\nText.\n\n=para\nOther.\n'
    const outside = src.indexOf('=para')
    const kept = many(10, outside)
    fromRules = [...many(200_000, 3), ...kept]
    const { violations, silenced } = lintSource(src, 'big.podlite', {})
    expect(violations).toEqual(kept)
    expect(silenced).toBe(200_000)
  })

  it('drops every message of a rule turned off in the config', () => {
    fromRules = many(200_000)
    const { violations } = lintSource('=pod\n\nText.\n', 'big.podlite', { rules: { 'x-many': 'off' } })
    expect(violations).toEqual([])
  })

  it('reports the source rules before the rules over the tree', () => {
    fromRules = many(2)
    const { violations } = lintSource('=begin pod\nText.\n', 'open.podlite', {})
    expect(violations.map(v => v.rule)).toEqual(['delimited-block-balance', 'x-many', 'x-many'])
  })
})
