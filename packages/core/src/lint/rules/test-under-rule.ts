import { canOwnTest, mayHoldTests } from '@podlite/schema'
import type { PodliteDocument } from '@podlite/schema'
import type { Rule, Violation, LintContext } from '../types'
import type { IncludeOrigin } from '../../assemble'
import { assembleForLint, includedName } from './include-resolves'

export const TEST_UNDER_RULE_RULE_ID = 'test-under-rule'

type Node = {
  type?: unknown
  name?: unknown
  level?: unknown
  content?: unknown
  location?: Violation['location']
}

const isNode = (value: unknown): value is Node => typeof value === 'object' && value !== null

const isTest = (node: Node): boolean => node.type === 'block' && node.name === 'test'

const isBlank = (node: Node): boolean => node.type === 'blankline'

const nameOf = (node: Node): string => {
  if (node.type === 'block' && node.name === 'head') return `=head${node.level ?? ''}`
  if (node.type === 'block' && typeof node.name === 'string') return `=${node.name}`
  if (node.type === 'config' || node.type === 'alias') return `=${node.type} ${String(node.name ?? '')}`.trimEnd()
  return String(node.type)
}

export const testUnderRuleRule: Rule = {
  id: TEST_UNDER_RULE_RULE_ID,
  severity: 'warning',
  check: (ast: PodliteDocument, ctx: LintContext): Violation[] => {
    if (ctx.fileType === 'md') return []
    const assembled = assembleForLint(ast, ctx)
    // an assembly that met problems still holds every include that did resolve
    const whole = assembled && !(assembled instanceof Error) ? assembled : undefined
    const origin: WeakMap<object, IncludeOrigin> | undefined = whole?.origin
    // an include that did not resolve leaves no node in the assembled tree, only
    // the place of its directive among the problems
    const unresolved = (whole?.problems ?? [])
      .map(problem => problem.chain[0]?.location?.start.offset)
      .filter((offset): offset is number => typeof offset === 'number')

    const stepOf = (node: Node) => {
      const from = origin?.get(node)
      const step = from?.steps?.[0]
      return from && step ? { from, step } : undefined
    }
    // where a node ends in this file: a node an include brought ends at its directive
    const endHere = (node: Node): number | undefined => {
      const placed = stepOf(node)
      return placed ? placed.step.location?.end.offset : node.location?.end.offset
    }

    const violations: Violation[] = []
    const report = (test: Node, message: string) => {
      const placed = stepOf(test)
      if (!placed) {
        violations.push({ rule: TEST_UNDER_RULE_RULE_ID, severity: 'warning', message, location: test.location })
        return
      }
      const line = test.location ? `:${test.location.start.line}` : ''
      violations.push({
        rule: TEST_UNDER_RULE_RULE_ID,
        severity: 'warning',
        message: `${message} (in ${includedName(placed.from.file, ctx)}${line})`,
        location: placed.step.location,
      })
    }

    const visit = (nodes: unknown, start: number): void => {
      if (!Array.isArray(nodes)) return
      nodes.forEach((node, i) => {
        if (!isNode(node)) return
        if (isTest(node)) {
          let sibling: Node | undefined
          for (let j = i - 1; j >= 0; j--) {
            const before = nodes[j]
            if (!isNode(before) || isBlank(before) || isTest(before)) continue
            sibling = before
            break
          }
          // a written include that is not read could have brought the rule
          if (sibling && sibling.type === 'block' && sibling.name === 'include') return
          const testStart = node.location?.start.offset
          if (!stepOf(node) && typeof testStart === 'number') {
            const from = sibling ? endHere(sibling) ?? start : start
            if (unresolved.some(at => at >= from && at < testStart)) return
          }
          if (!sibling) report(node, '=test has no rule above it')
          else if (!canOwnTest(sibling)) report(node, `=test stands under ${nameOf(sibling)}, not under a rule`)
          return
        }
        if ((node.type === 'block' || node.type === 'list') && mayHoldTests(node)) {
          visit(node.content, node.location?.start.offset ?? start)
        }
      })
    }

    const root: unknown = whole ? whole.tree : ast
    visit(isNode(root) ? root.content : [], 0)
    return violations
  },
}
