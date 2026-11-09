import type { PodliteDocument } from '@podlite/schema'
import type { Rule, Violation, LintContext } from '../types'

export const LIST_DEPTH_RULE_ID = 'list-depth'

// passes on what the parser reports about a list nested deeper than it builds
export const listDepthRule: Rule = {
  id: LIST_DEPTH_RULE_ID,
  severity: 'warning',
  check: (ast: PodliteDocument, _ctx: LintContext): Violation[] =>
    (ast.diagnostics || [])
      .filter(d => d.code === 'list-too-deep')
      .map(d => ({ rule: LIST_DEPTH_RULE_ID, severity: d.severity, message: d.message, location: d.location })),
}
