import type { PodliteDocument } from '@podlite/schema'
import { runRules } from '../src/lint/engine'
import type { Rule, LintContext } from '../src/lint/types'

const ast: PodliteDocument = {
  type: 'block',
  name: 'root',
  margin: '',
  content: [],
}
const ctx: LintContext = { filePath: 'fake.podlite', fileType: 'podlite', config: {} }

describe('runRules', () => {
  it('returns [] when no rules', () => {
    expect(runRules(ast, [], ctx)).toEqual([])
  })

  it('aggregates violations from multiple rules', () => {
    const r1: Rule = {
      id: 'r1',
      severity: 'error',
      check: () => [{ rule: 'r1', severity: 'error', message: 'a' }],
    }
    const r2: Rule = {
      id: 'r2',
      severity: 'warning',
      check: () => [{ rule: 'r2', severity: 'warning', message: 'b' }],
    }
    expect(runRules(ast, [r1, r2], ctx).map(v => v.rule)).toEqual(['r1', 'r2'])
  })

  it('rule may return [] for graceful skip', () => {
    const skipping: Rule = { id: 'skip', severity: 'info', check: () => [] }
    const firing: Rule = {
      id: 'fire',
      severity: 'error',
      check: () => [{ rule: 'fire', severity: 'error', message: 'x' }],
    }
    expect(runRules(ast, [skipping, firing], ctx)).toHaveLength(1)
  })
})
