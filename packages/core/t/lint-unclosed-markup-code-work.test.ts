let verbatimChecks = 0

jest.mock('@podlite/schema', () => {
  const actual = jest.requireActual('@podlite/schema')
  return {
    ...actual,
    isVerbatimBlock: (name: string) => {
      verbatimChecks += 1
      return actual.isVerbatimBlock(name)
    },
  }
})

import { scanUnclosedMarkupCodes } from '../src/lint/rules/unclosed-markup-code'

type Method = 'slice' | 'split' | 'includes' | 'indexOf' | 'lastIndexOf'

// the span each string method may look through: what slice returns, the whole string
// split cuts, and the part of the string a search starts in
const span: Record<Method, (receiver: string, args: unknown[], result: unknown) => number> = {
  slice: (_, __, result) => (result as string).length,
  split: receiver => receiver.length,
  includes: (receiver, args) => receiver.length - Math.min(Math.max(Number(args[1] ?? 0) || 0, 0), receiver.length),
  indexOf: (receiver, args) => receiver.length - Math.min(Math.max(Number(args[1] ?? 0) || 0, 0), receiver.length),
  lastIndexOf: (receiver, args) =>
    receiver.length === 0
      ? 0
      : Math.min(args[1] === undefined ? receiver.length - 1 : Math.max(Number(args[1]) || 0, 0), receiver.length - 1) +
        1,
}

const budget = (input: string): { units: number; messages: number } => {
  const saved = new Map<Method, Function>()
  let units = 0
  let messages = 0
  for (const name of Object.keys(span) as Method[]) {
    const original = String.prototype[name] as Function
    saved.set(name, original)
    Object.defineProperty(String.prototype, name, {
      configurable: true,
      writable: true,
      value: function (this: string, ...args: unknown[]) {
        const result = Reflect.apply(original, this, args)
        units += span[name](String(this), args, result)
        return result
      },
    })
  }
  try {
    messages = scanUnclosedMarkupCodes(input).length
  } finally {
    for (const [name, original] of saved) {
      Object.defineProperty(String.prototype, name, { configurable: true, writable: true, value: original })
    }
  }
  return { units, messages }
}

const growth = (make: (n: number) => string) => {
  const small = budget(make(200))
  const large = budget(make(400))
  return { small, large, ratio: large.units / small.units }
}

describe('unclosed-markup-code work grows with the text', () => {
  it.each([
    ['unclosed codes', (n: number) => '=for para\n' + 'B<x\n'.repeat(n), 1],
    ['closed codes', (n: number) => '=for para\n' + 'B<x> '.repeat(n), 0],
    ['unclosed guillemets', (n: number) => '=for para\n' + 'B«x\n'.repeat(n), 1],
    ['unclosed doubled brackets', (n: number) => '=for para\n' + 'B<< x\n'.repeat(n), 1],
  ])('%s', (_, make, perCode) => {
    const { small, large, ratio } = growth(make as (n: number) => string)
    expect(small.messages).toBe(200 * (perCode as number))
    expect(large.messages).toBe(400 * (perCode as number))
    expect(small.units).toBeGreaterThan(0)
    expect(ratio).toBeLessThanOrEqual(2.5)
  })

  it('reads the line of each code without going back to the start of the paragraph', () => {
    const found = scanUnclosedMarkupCodes('=for para\n' + 'B<x\n'.repeat(5))
    expect(found.map(v => v.location?.start.line)).toEqual([2, 3, 4, 5, 6])
  })

  it('asks whether a block is verbatim once per line, however deep the blocks are', () => {
    const nested = (n: number) => '=begin pod\n'.repeat(n) + 'B<x\n'.repeat(n) + '=end pod\n'.repeat(n)
    verbatimChecks = 0
    scanUnclosedMarkupCodes(nested(200))
    const small = verbatimChecks
    verbatimChecks = 0
    scanUnclosedMarkupCodes(nested(400))
    expect(small).toBeGreaterThan(0)
    expect(verbatimChecks / small).toBeLessThanOrEqual(2.5)
  })
})

describe('unclosed-markup-code reports as before', () => {
  const lines = (src: string) => scanUnclosedMarkupCodes(src).map(v => [v.location?.start.line, v.message.slice(0, 3)])

  it.each([
    ['an unclosed code', 'B<x\n', [[1, 'B<>']]],
    ['a closed code', 'B<x>\n', []],
    ['doubled brackets closed by two', 'B<< x >>\n', []],
    ['doubled brackets with a single closer', 'B<< x >\n', [[1, 'B<>']]],
    ['guillemets', 'B«x»\n', []],
    ['an open guillemet', 'B«x\n', [[1, 'B<>']]],
    [
      'codes on several lines of one paragraph',
      'a B<x\nb\nc I<y\n',
      [
        [1, 'B<>'],
        [3, 'I<>'],
      ],
    ],
    [
      'CRLF',
      'a B<x\r\nb\r\nc I<y\r\n',
      [
        [1, 'B<>'],
        [3, 'I<>'],
      ],
    ],
  ])('%s', (_, src, expected) => {
    expect(lines(src as string)).toEqual(expected)
  })

  it('keeps silent inside a verbatim block after an inner block closes', () => {
    expect(lines('=begin code\n=begin pod\n=end pod\nB<x\n=end code\nB<y\n')).toEqual([[6, 'B<>']])
  })
})
