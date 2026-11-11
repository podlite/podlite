import { parseContent } from '../src/lint/loader'
import { deadDefinitionsRule } from '../src/lint/rules/dead-definitions'
import type { LintContext, Violation } from '../src/lint/types'

const ctx = (source: string): LintContext => ({ filePath: 'doc.podlite', fileType: 'podlite', config: {}, source })

// how many times the rule splits the whole source and how many regular expression
// matches it runs; the tree is built before counting starts
const work = (source: string): { splits: number; matches: number; found: Violation[] } => {
  const ast = parseContent(source, 'podlite')
  const split = String.prototype.split
  const exec = RegExp.prototype.exec
  let splits = 0
  let matches = 0
  let found: Violation[] = []
  Object.defineProperty(String.prototype, 'split', {
    configurable: true,
    writable: true,
    value: function (this: string, ...args: unknown[]) {
      if (String(this) === source) splits += 1
      return Reflect.apply(split, this, args)
    },
  })
  Object.defineProperty(RegExp.prototype, 'exec', {
    configurable: true,
    writable: true,
    value: function (this: RegExp, ...args: unknown[]) {
      matches += 1
      return Reflect.apply(exec, this, args)
    },
  })
  try {
    found = deadDefinitionsRule.check(ast, ctx(source))
  } finally {
    Object.defineProperty(String.prototype, 'split', { configurable: true, writable: true, value: split })
    Object.defineProperty(RegExp.prototype, 'exec', { configurable: true, writable: true, value: exec })
  }
  return { splits, matches, found }
}

const unused = (n: number) =>
  '=pod\n' + Array.from({ length: n }, (_, i) => `=alias A${String(i).padStart(3, '0')} x\n`).join('') + '\n'

describe('dead-definitions reads the source once for the lines of unused aliases', () => {
  it('splits the source once and matches in proportion to it', () => {
    const small = work(unused(200))
    const large = work(unused(400))
    expect([small.splits, large.splits]).toEqual([1, 1])
    expect(small.matches).toBeGreaterThan(0)
    expect(large.matches / small.matches).toBeLessThanOrEqual(2.5)
    expect(small.found).toHaveLength(200)
    expect(large.found.map(v => v.location?.start.line)).toEqual(Array.from({ length: 400 }, (_, i) => i + 2))
  })

  it('does not read the source when every alias is used', () => {
    expect(work('=alias A x\n\nA<A>\n').splits).toBe(0)
  })
})

describe('dead-definitions places alias warnings as before', () => {
  const lines = (source: string) => work(source).found.map(v => [v.location?.start.line, v.message.split(';')[0]])

  it('places each unused alias on its line', () => {
    expect(lines('=pod\n=alias A x\n=alias B y\n\nA<A>\n')).toEqual([[3, '=alias B is never used']])
  })

  it('places both declarations of one name on the first', () => {
    expect(lines('=alias A x\n=alias A y\n')).toEqual([
      [1, '=alias A is never used'],
      [1, '=alias A is never used'],
    ])
  })

  it('finds an indented declaration', () => {
    expect(lines('=begin pod\n  =alias A x\n=end pod\n')).toEqual([[2, '=alias A is never used']])
  })

  it('reads CRLF lines', () => {
    expect(lines('x\r\n=alias A x\r\n')).toEqual([[2, '=alias A is never used']])
  })
})
