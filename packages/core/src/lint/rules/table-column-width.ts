import type { PodliteDocument } from '@podlite/schema'
import type { Rule, Violation, LintContext } from '../types'

export const TABLE_COLUMN_WIDTH_RULE_ID = 'table-column-width'

const named = (d: { code: string }): boolean => d.code === TABLE_COLUMN_WIDTH_RULE_ID

// passes on what the parser reports under this name
export const tableColumnWidthRule: Rule = {
  id: TABLE_COLUMN_WIDTH_RULE_ID,
  severity: 'warning',
  check: (ast: PodliteDocument, _ctx: LintContext): Violation[] =>
    (ast.diagnostics || []).filter(named).map(d => ({
      rule: TABLE_COLUMN_WIDTH_RULE_ID,
      severity: d.severity,
      message: d.message,
      location: d.location,
    })),
}
