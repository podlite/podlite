import type { PodliteDocument } from '@podlite/schema'
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

export const syntaxValidRule: Rule = {
  id: SYNTAX_VALID_RULE_ID,
  severity: 'error',
  check: (_ast: PodliteDocument, _ctx: LintContext): Violation[] => [],
}
