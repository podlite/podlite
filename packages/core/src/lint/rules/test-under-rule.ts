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

// the outcomes of an include that brought nothing, or brought what is not known
// yet; an ambiguous address still brings the block it found
const UNKNOWN_OUTCOME = new Set([
  'source',
  'address',
  'unparsed-selector',
  'unsupported-scheme',
  'operand',
  'format',
  'cycle',
  'incomplete-selection',
])

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

    const stepOf = (node: Node) => {
      const from = origin?.get(node)
      const step = from?.steps?.[0]
      return from && step ? { from, step } : undefined
    }
    // the file a node is written in; undefined for this document
    const fileOf = (node: Node): string | undefined => stepOf(node)?.from.file
    const startOf = (node: Node): number | undefined => node.location?.start.offset
    const endOf = (node: Node): number | undefined => node.location?.end.offset

    // an include that brought nothing leaves no node in the assembled tree, only
    // the place of its directive among the problems: a rule could stand there
    const failed = (whole?.problems ?? [])
      .filter(problem => UNKNOWN_OUTCOME.has(problem.kind))
      .flatMap(problem => {
        const last = problem.chain[problem.chain.length - 1]
        const at = last?.location?.start.offset
        return typeof at === 'number' ? [{ file: problem.chain.length > 1 ? last.file : undefined, at }] : []
      })
    const failedBetween = (file: string | undefined, from: number, to: number, skipped: Node[]) =>
      failed.some(
        f =>
          f.file === file &&
          f.at >= from &&
          f.at < to &&
          // an include inside a test passed over says nothing of the place before the test
          !skipped.some(t => fileOf(t) === file && (startOf(t) ?? Infinity) <= f.at && f.at < (endOf(t) ?? -Infinity)),
      )

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

    // whether an include that did not resolve stands between the test and the block above it
    const unknownAbove = (test: Node, sibling: Node | undefined, parent: Node | undefined, skipped: Node[]) => {
      const file = fileOf(test)
      const to = startOf(test)
      if (typeof to === 'number') {
        const from =
          sibling && fileOf(sibling) === file ? endOf(sibling) : parent && fileOf(parent) === file ? startOf(parent) : 0
        if (failedBetween(file, from ?? 0, to, skipped)) return true
      }
      const placed = stepOf(test)
      const at = placed?.step.location?.start.offset
      if (typeof at !== 'number') return false
      // a test an include brought: the place of that include in this document
      const above = sibling
        ? stepOf(sibling)?.step.location?.end.offset ?? endOf(sibling)
        : parent && (stepOf(parent)?.step.location?.start.offset ?? startOf(parent))
      return failedBetween(undefined, above ?? 0, at, skipped)
    }

    const visit = (nodes: unknown, parent: Node | undefined): void => {
      if (!Array.isArray(nodes)) return
      nodes.forEach((node, i) => {
        if (!isNode(node)) return
        if (isTest(node)) {
          let sibling: Node | undefined
          const skipped: Node[] = []
          for (let j = i - 1; j >= 0; j--) {
            const before = nodes[j]
            if (!isNode(before) || isBlank(before)) continue
            if (isTest(before)) {
              skipped.push(before)
              continue
            }
            sibling = before
            break
          }
          // a written include that is not read could have brought the rule
          if (sibling && sibling.type === 'block' && sibling.name === 'include') return
          if (unknownAbove(node, sibling, parent, skipped)) return
          if (!sibling) report(node, '=test has no rule above it')
          else if (!canOwnTest(sibling)) report(node, `=test stands under ${nameOf(sibling)}, not under a rule`)
          return
        }
        if ((node.type === 'block' || node.type === 'list') && mayHoldTests(node)) visit(node.content, node)
      })
    }

    const root: unknown = whole ? whole.tree : ast
    visit(isNode(root) ? root.content : [], undefined)
    return violations
  },
}
