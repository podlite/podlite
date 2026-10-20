import type { PodliteDocument } from '@podlite/schema'
import type { Rule, Violation, LintContext } from '../types'
import { assembleForLint } from './include-resolves'

export const ITEM_HIERARCHY_RULE_ID = 'item-hierarchy'

type Node = {
  type?: string
  name?: string
  level?: unknown
  content?: unknown
  location?: Violation['location']
}

const WRAPPERS = new Set(['root', '_folded_section'])

const isNode = (value: unknown): value is Node => typeof value === 'object' && value !== null

// the level is in the name: =item is =item1, =item3 is 3; anything else is no level
const levelOf = (node: Node): number | undefined => {
  if (node.level === undefined) return 1
  if (typeof node.level !== 'number' && typeof node.level !== 'string') return undefined
  const level = /^[1-9][0-9]*$/.test(String(node.level)) ? Number(node.level) : NaN
  return Number.isSafeInteger(level) ? level : undefined
}

export const itemHierarchyRule: Rule = {
  id: ITEM_HIERARCHY_RULE_ID,
  severity: 'warning',
  check: (ast: PodliteDocument, ctx: LintContext): Violation[] => {
    // a Markdown list nests its sublists inside the item, which is no =item block
    if (ctx.fileType === 'md') return []
    const assembled = assembleForLint(ast, ctx)
    // with an include not read, the written tree is checked and the include holds what follows
    const whole = assembled && !(assembled instanceof Error) && assembled.problems.length === 0 ? assembled : undefined
    const violations: Violation[] = []

    type Scope = { seen: Set<number>; unknown: boolean }
    const visit = (nodes: unknown, scope: Scope): void => {
      if (!Array.isArray(nodes)) return
      for (const node of nodes) {
        if (!isNode(node)) continue
        // lists, folded sections and included roots are no surrounding block of the norm
        if (node.type === 'list' || (node.type === 'block' && WRAPPERS.has(node.name ?? ''))) {
          visit(node.content, scope)
          continue
        }
        if (node.type === 'block' && node.name === 'include') {
          scope.unknown = true
          continue
        }
        if (node.type === 'block' && node.name === 'item') {
          const level = levelOf(node)
          if (level !== undefined) {
            // an item an include placed here counts as preceding but is not reported
            const included = (whole?.origin.get(node)?.steps?.length ?? 0) > 0
            if (level > 1 && !scope.seen.has(level - 1) && !included && !scope.unknown) {
              violations.push({
                rule: ITEM_HIERARCHY_RULE_ID,
                severity: 'warning',
                message: `=item${level} has no preceding =item${level - 1} in the same block`,
                location: node.location,
              })
            }
            scope.seen.add(level)
          }
        }
        if (node.type === 'block') visit(node.content, { seen: new Set(), unknown: false })
      }
    }

    const root: unknown = whole ? whole.tree : ast
    visit(isNode(root) ? root.content : [], { seen: new Set(), unknown: false })
    return violations
  },
}
