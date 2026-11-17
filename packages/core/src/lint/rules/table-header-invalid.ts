import type { PodliteDocument } from '@podlite/schema'
import type { Rule, Violation, LintContext } from '../types'

export const TABLE_HEADER_INVALID_RULE_ID = 'table-header-invalid'

// passes on a `header` of CSV or TSV data that is neither present nor absent: an
// error the norm names, kept apart from table-shape so that silencing the shape of
// tables does not silence it
export const tableHeaderInvalidRule: Rule = {
  id: TABLE_HEADER_INVALID_RULE_ID,
  severity: 'error',
  check: (ast: PodliteDocument, _ctx: LintContext): Violation[] =>
    (ast.diagnostics || [])
      .filter(d => d.code === 'table-header-invalid')
      .map(d => ({
        rule: TABLE_HEADER_INVALID_RULE_ID,
        severity: d.severity,
        message: d.message,
        location: d.location,
      })),
}
