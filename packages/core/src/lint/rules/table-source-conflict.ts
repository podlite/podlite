import type { PodliteDocument } from '@podlite/schema'
import type { Rule, Violation, LintContext } from '../types'

export const TABLE_SOURCE_CONFLICT_RULE_ID = 'table-source-conflict'

// an error the norm names, kept apart from table-shape so that silencing that rule does not silence it
export const tableSourceConflictRule: Rule = {
  id: TABLE_SOURCE_CONFLICT_RULE_ID,
  severity: 'error',
  check: (ast: PodliteDocument, _ctx: LintContext): Violation[] =>
    (ast.diagnostics || [])
      .filter(d => d.code === 'table-source-conflict')
      .map(d => ({
        rule: TABLE_SOURCE_CONFLICT_RULE_ID,
        severity: d.severity,
        message: d.message,
        location: d.location,
      })),
}
