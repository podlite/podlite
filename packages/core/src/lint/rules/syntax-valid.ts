import { getFromTree, PodliteDocument } from '@podlite/schema'
import type { Rule, Violation, LintContext } from '../types'

export const SYNTAX_VALID_RULE_ID = 'syntax-valid'

export function makeSyntaxViolation(err: unknown, filePath: string): Violation {
  const e = err as { message?: string; location?: { start?: { line?: number; column?: number; offset?: number } } }
  const start = e?.location?.start
  return {
    rule: SYNTAX_VALID_RULE_ID,
    severity: 'error',
    message: e?.message ? String(e.message).split('\n')[0] : 'Parse error',
    location: e?.location
      ? {
          start: {
            line: start?.line ?? 1,
            column: start?.column ?? 1,
            offset: start?.offset ?? 0,
          },
          end: {
            line: start?.line ?? 1,
            column: start?.column ?? 1,
            offset: start?.offset ?? 0,
          },
        }
      : undefined,
  }
}

export function collectRecoveredErrors(ast: PodliteDocument): Violation[] {
  const nodes = getFromTree(ast, () => true) as Array<{
    error?: boolean
    value?: unknown
    location?: Violation['location']
  }>
  const violations: Violation[] = []
  for (const node of nodes) {
    if (node && node.error === true) {
      const snippet = String(node.value ?? '').trim()
      violations.push({
        rule: SYNTAX_VALID_RULE_ID,
        severity: 'warning',
        message: `Line could not be parsed as a directive or block: ${snippet}`,
        location: node.location,
      })
    }
  }
  return violations
}

export const syntaxValidRule: Rule = {
  id: SYNTAX_VALID_RULE_ID,
  severity: 'error',
  check: (ast: PodliteDocument, _ctx: LintContext): Violation[] => collectRecoveredErrors(ast),
}
