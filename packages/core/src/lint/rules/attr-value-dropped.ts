import type { PodliteDocument } from '@podlite/schema'
import type { Rule, Violation, LintContext } from '../types'

export const ATTR_VALUE_DROPPED_RULE_ID = 'attr-value-dropped'

export const attrValueDroppedRule: Rule = {
  id: ATTR_VALUE_DROPPED_RULE_ID,
  severity: 'warning',
  // a directive the parser could not read is the business of syntax-valid,
  // a table that was reshaped is the business of table-shape
  check: (ast: PodliteDocument, _ctx: LintContext): Violation[] =>
    (ast.diagnostics || [])
      .filter(d => d.code === 'value-unreadable')
      .map(d => ({
        rule: ATTR_VALUE_DROPPED_RULE_ID,
        severity: d.severity,
        message: d.message,
        location: d.location,
      })),
}
