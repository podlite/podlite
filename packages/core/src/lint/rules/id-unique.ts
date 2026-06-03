import { getFromTree, PodliteDocument } from '@podlite/schema'
import type { Rule, Violation, LintContext } from '../types'

export const ID_UNIQUE_RULE_ID = 'id-unique'

type IdEntry = { value: string; location?: Violation['location'] }

export function collectExplicitIds(ast: PodliteDocument): IdEntry[] {
  const nodes = getFromTree(ast, () => true) as Array<{
    config?: Array<{ name?: string; value?: unknown }>
    location?: Violation['location']
  }>
  const entries: IdEntry[] = []
  for (const node of nodes) {
    const config = Array.isArray(node.config) ? node.config : []
    for (const item of config) {
      if (item && item.name === 'id' && item.value !== undefined && item.value !== null) {
        entries.push({ value: String(item.value), location: node.location })
      }
    }
  }
  return entries
}

export const idUniqueRule: Rule = {
  id: ID_UNIQUE_RULE_ID,
  severity: 'error',
  check: (ast: PodliteDocument, _ctx: LintContext): Violation[] => {
    const entries = collectExplicitIds(ast)
    if (entries.length === 0) return []
    const seen = new Set<string>()
    const violations: Violation[] = []
    for (const entry of entries) {
      if (seen.has(entry.value)) {
        violations.push({
          rule: ID_UNIQUE_RULE_ID,
          severity: 'error',
          message: `Duplicate :id<${entry.value}>`,
          location: entry.location,
        })
      } else {
        seen.add(entry.value)
      }
    }
    return violations
  },
}
