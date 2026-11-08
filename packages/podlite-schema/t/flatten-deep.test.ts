import { flattenDeep } from '../src/helpers/flatten-deep'
import makeTransformer from '../src/helpers/makeTransformer'

// the way lists were put together before, kept here to compare with
const before = (arr: unknown[]): unknown[] =>
  arr.reduce<unknown[]>((acc, val) => (Array.isArray(val) ? acc.concat(before(val)) : acc.concat(val)), [])

const spreadable = (items: Record<number, unknown>, length: number) => ({
  ...items,
  length,
  [Symbol.isConcatSpreadable]: true,
})

describe('flattenDeep gives what concat gave', () => {
  const cases: [string, unknown[]][] = [
    ['nested lists', [1, [2, [3, [4]]], 5]],
    ['empty lists', [[], [[]], []]],
    ['holes of a list', [1, , [2, , 3]]],
    ['strings and objects', ['a', { b: 1 }, ['c']]],
    ['a list marked not to spread', [Object.assign([1, 2], { [Symbol.isConcatSpreadable]: false }), 3]],
    ['an object that spreads one level, holes kept', [0, spreadable({ 1: [1, [2]], 3: 4 }, 4)]],
  ]
  for (const [name, input] of cases) {
    it(`for ${name}`, () => {
      const got = flattenDeep(input)
      const want = before(input)
      expect(got).toEqual(want)
      expect(Object.keys(got)).toEqual(Object.keys(want))
    })
  }

  it('keeps a list inside a spread object as it is', () => {
    const inner = [1, [2]]
    expect(flattenDeep([spreadable({ 0: inner }, 1)])[0]).toBe(inner)
  })

  it('keeps a hole of a spread object even when a list inherits that index', () => {
    const value = {
      length: 2,
      get 1() {
        Object.defineProperty(Array.prototype, 0, { value: 'inherited', configurable: true, writable: true })
        return 'x'
      },
      [Symbol.isConcatSpreadable]: true,
    }
    try {
      expect(Object.keys(flattenDeep([value]))).toEqual(['1'])
    } finally {
      Reflect.deleteProperty(Array.prototype, 0)
    }
  })

  it('spreads an object a rule returns, as before', () => {
    const value = spreadable({ 0: 'x' }, 1)
    const transform = makeTransformer({ 'x:text': () => value })
    expect(transform([{ name: 'x', type: 'text' }])).toEqual(['x'])
  })
})
