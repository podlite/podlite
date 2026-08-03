import type { PodliteDocument } from '@podlite/schema'
import type { Rule, Violation, LintContext } from '../types'

export const ATTR_VALUE_DROPPED_RULE_ID = 'attr-value-dropped'

export const attrValueDroppedRule: Rule = {
  id: ATTR_VALUE_DROPPED_RULE_ID,
  severity: 'warning',
  // a directive the parser could not read is the business of syntax-valid
  check: (ast: PodliteDocument, _ctx: LintContext): Violation[] =>
    (ast.diagnostics || [])
      .filter(d => d.code !== 'directive-unreadable')
      .map(d => ({
        rule: ATTR_VALUE_DROPPED_RULE_ID,
        severity: d.severity,
        message: d.message,
        location: d.location,
      })),
}
