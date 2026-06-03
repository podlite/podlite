import { getFromTree, PodliteDocument } from '@podlite/schema'
import type { Rule, Violation, LintContext } from '../types'

export const HEADING_HIERARCHY_RULE_ID = 'heading-hierarchy'

export const headingHierarchyRule: Rule = {
  id: HEADING_HIERARCHY_RULE_ID,
  severity: 'warning',
  check: (ast: PodliteDocument, _ctx: LintContext): Violation[] => {
    const heads = getFromTree(ast, 'head')
    const violations: Violation[] = []
    let prev: number | null = null
    for (const node of heads) {
      const level = Number((node as { level?: number | string }).level)
      if (!Number.isFinite(level) || level < 1) continue
      if (prev !== null && level - prev > 1) {
        violations.push({
          rule: HEADING_HIERARCHY_RULE_ID,
          severity: 'warning',
          message: `Heading level jump from ${prev} to ${level}`,
          location: (node as { location?: Violation['location'] }).location,
        })
      }
      prev = level
    }
    return violations
  },
}
