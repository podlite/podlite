import type { PodliteDocument } from '@podlite/schema'
import type { Rule, Violation, LintContext } from '../types'

export const MARKUP_CODE_TOO_DEEP_RULE_ID = 'markup-code-too-deep'

// The parser writes codes nested past its limit out as text and says so; the
// message is passed on as it stands.
export const markupCodeTooDeepRule: Rule = {
  id: MARKUP_CODE_TOO_DEEP_RULE_ID,
  severity: 'warning',
  check: (ast: PodliteDocument, _ctx: LintContext): Violation[] =>
    (ast.diagnostics || [])
      .filter(d => d.code === 'markup-code-too-deep')
      .map(d => ({
        rule: MARKUP_CODE_TOO_DEEP_RULE_ID,
        severity: d.severity,
        message: d.message,
        location: d.location,
      })),
}
