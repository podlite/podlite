import type { PodliteDocument } from '@podlite/schema'
import type { Rule, Violation, LintContext } from '../types'

export const TABLE_SHAPE_RULE_ID = 'table-shape'

const TABLE_CODES = ['table-row-cells', 'table-mixed-separators', 'table-source-unreadable']

export const tableShapeRule: Rule = {
  id: TABLE_SHAPE_RULE_ID,
  severity: 'warning',
  check: (ast: PodliteDocument, _ctx: LintContext): Violation[] =>
    (ast.diagnostics || [])
      .filter(d => TABLE_CODES.includes(d.code))
      .map(d => ({
        rule: TABLE_SHAPE_RULE_ID,
        severity: d.severity,
        message: d.message,
        location: d.location,
      })),
}
