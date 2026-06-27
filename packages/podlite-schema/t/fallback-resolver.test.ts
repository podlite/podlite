import { parse } from '../src'
import {
  collectFallbackMap,
  resolveFallback,
  FallbackCycleError,
  FallbackDepthError,
  FallbackMissingTargetError,
} from '../src/fallback-resolver'

const known =
  (...types: string[]) =>
  (t: string) =>
    types.includes(t)

describe('collectFallbackMap', () => {
  it('collects config fallback declarations into a type map', () => {
    const ast = parse('=pod\n=config Recipe :fallback<para>\n=config Card :fallback<code>\n')
    const map = collectFallbackMap(ast)
    expect(map.get('Recipe')).toBe('para')
    expect(map.get('Card')).toBe('code')
    expect(map.has('para')).toBe(false)
  })
})

describe('resolveFallback', () => {
  it('resolves a chain to its terminal type', () => {
    const map = new Map([
      ['Recipe', 'Card'],
      ['Card', 'para'],
    ])
    const res = resolveFallback('Recipe', map, { isTerminal: known('para') })
    expect(res.resolved).toBe('para')
    expect(res.chain).toEqual(['Recipe', 'Card', 'para'])
  })

  it('follows a per-instance start type override', () => {
    const map = new Map([['Recipe', 'para']])
    const res = resolveFallback('Recipe', map, { isTerminal: known('para', 'code') })
    expect(res.resolved).toBe('para')
  })

  it('stops at the first terminal in a chain', () => {
    const map = new Map([
      ['Recipe', 'Card'],
      ['Card', 'para'],
    ])
    const res = resolveFallback('Recipe', map, { isTerminal: known('Card') })
    expect(res.resolved).toBe('Card')
    expect(res.chain).toEqual(['Recipe', 'Card'])
  })

  it('throws on a cycle', () => {
    const map = new Map([
      ['A', 'B'],
      ['B', 'A'],
    ])
    expect(() => resolveFallback('A', map, { isTerminal: known('para') })).toThrow(FallbackCycleError)
    try {
      resolveFallback('A', map, { isTerminal: known('para') })
    } catch (e) {
      expect((e as FallbackCycleError).chain).toEqual(['A', 'B', 'A'])
    }
  })

  it('throws when the chain exceeds max depth', () => {
    const map = new Map([
      ['A1', 'A2'],
      ['A2', 'A3'],
      ['A3', 'para'],
    ])
    expect(() => resolveFallback('A1', map, { isTerminal: known('para'), maxDepth: 2 })).toThrow(FallbackDepthError)
  })

  it('respects a raised max depth', () => {
    const map = new Map([
      ['A1', 'A2'],
      ['A2', 'A3'],
      ['A3', 'para'],
    ])
    const res = resolveFallback('A1', map, { isTerminal: known('para'), maxDepth: 8 })
    expect(res.resolved).toBe('para')
  })

  it('throws when the chain dead-ends at an undefined target', () => {
    const map = new Map([['Recipe', 'Ghost']])
    expect(() => resolveFallback('Recipe', map, { isTerminal: known('para') })).toThrow(FallbackMissingTargetError)
    try {
      resolveFallback('Recipe', map, { isTerminal: known('para') })
    } catch (e) {
      expect((e as FallbackMissingTargetError).target).toBe('Ghost')
    }
  })

  it('reports missing target before cycle when a hop dead-ends', () => {
    const map = new Map([
      ['A', 'B'],
      ['B', 'Ghost'],
    ])
    expect(() => resolveFallback('A', map, { isTerminal: known('para') })).toThrow(FallbackMissingTargetError)
  })

  it('returns the endpoint without a terminal predicate', () => {
    const map = new Map([['Recipe', 'para']])
    const res = resolveFallback('Recipe', map)
    expect(res.resolved).toBe('para')
    expect(res.chain).toEqual(['Recipe', 'para'])
  })
})
