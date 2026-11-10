import type { Violation } from 'podlite/lib/lint/types'

// what the rules over the tree return; when unset, the real rules run, and with withReal set
// the real rules run after these: only they ask for the files an include names
let fromRules: Violation[] | null = null
let withReal = false
let calls = 0

jest.mock('podlite/lib/lint/engine', () => {
  const actual = jest.requireActual('podlite/lib/lint/engine')
  return {
    ...actual,
    runRules: (...args: unknown[]) => {
      calls += 1
      if (!fromRules) return actual.runRules(...args)
      return withReal ? [...fromRules, ...actual.runRules(...args)] : fromRules
    },
  }
})

import { validateSource } from '../src/tools'

const many = (n: number): Violation[] =>
  Array.from({ length: n }, (_, i) => ({ rule: 'x-many', severity: 'warning' as const, message: String(i) }))

afterEach(() => {
  fromRules = null
  withReal = false
  calls = 0
})

describe('validate with a report too large to pass as arguments', () => {
  it('keeps every message of the rules in order and counts them', () => {
    fromRules = many(200_000)
    const report = validateSource('=pod\n\nText.\n')
    expect(calls).toBe(1)
    expect(report.problems.some(p => p.rule === 'syntax-valid')).toBe(false)
    expect(report.problems.map(p => p.message)).toEqual(fromRules.map(p => p.message))
    expect(report.counts).toEqual({ error: 0, warning: 200_000, info: 0 })
    expect(report.ok).toBe(true)
  })

  it('reports the source rules, then the rules over the tree, then the includes not checked', () => {
    fromRules = many(1)
    withReal = true
    const report = validateSource(
      '=pod\n\nPairs like B<key=value are separated.\n\nnext\n\n=include file:other.podlite\n',
    )
    expect(calls).toBe(1)
    expect(report.problems.map(p => p.rule)).toEqual(['unclosed-markup-code', 'x-many', 'include-resolves'])
  })
})
