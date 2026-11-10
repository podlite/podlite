import { parseContent } from '../src/lint/loader'
import { runRules } from '../src/lint/engine'
import { applyMutes } from '../src/lint/mute'
import type { LintContext, Rule, Violation } from '../src/lint/types'

const src = '=for para :lint-ignore<x-many>\nText.\n\n=para\nOther.\n'
const ast = parseContent(src, 'podlite')
const outside = src.indexOf('=para')

const many = (n: number, at: number): Violation[] =>
  Array.from({ length: n }, (_, i) => ({
    rule: 'x-many',
    severity: 'warning' as const,
    message: String(i),
    location: { start: { offset: at, line: 1, column: 1 }, end: { offset: at, line: 1, column: 1 } },
  }))

const rule: Rule = { id: 'x-many', severity: 'warning', check: () => many(200_000, outside) }
const ctx = (config: LintContext['config']): LintContext => ({
  filePath: 'big.podlite',
  fileType: 'podlite',
  config,
  source: src,
})

describe('the engine with a large report', () => {
  it('changes the severity a config sets', () => {
    const found = runRules(ast, [rule], ctx({ rules: { 'x-many': 'error' } }))
    expect(found).toHaveLength(200_000)
    expect(found.every(v => v.severity === 'error')).toBe(true)
  })

  it('runs no rule turned off in the config', () => {
    expect(runRules(ast, [rule], ctx({ rules: { 'x-many': 'off' } }))).toEqual([])
  })

  it('silences the messages inside a muting block', () => {
    const inside = many(200_000, 3)
    const kept = many(10, outside)
    const muted = applyMutes([...inside, ...kept], ast)
    expect(muted.kept).toEqual(kept)
    expect(muted.silenced).toBe(200_000)
  })
})
