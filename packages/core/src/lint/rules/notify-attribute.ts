import { getFromTree, PodliteDocument } from '@podlite/schema'
import type { Rule, Violation, LintContext } from '../types'

export const NOTIFY_ATTRIBUTE_RULE_ID = 'notify-attribute'

type ConfigEntry = { name?: string; from?: string }
type NestedNode = { type?: string; name?: string; config?: ConfigEntry[]; location?: Violation['location'] }

const isNested = (node: unknown): node is NestedNode =>
  typeof node === 'object' &&
  node !== null &&
  (node as NestedNode).type === 'block' &&
  (node as NestedNode).name === 'nested'

// The parser already puts on a block what =set and =config give it, marked by
// where it came from, so one reading of the block covers all three sources and
// gives one warning. A =config or =set of an including file reaches an included
// block only when the files are assembled; the tree of either file does not
// hold it, and such a loss is not reported.
export const notifyAttributeRule: Rule = {
  id: NOTIFY_ATTRIBUTE_RULE_ID,
  severity: 'warning',
  check: (ast: PodliteDocument, _ctx: LintContext): Violation[] =>
    getFromTree(ast, () => true).flatMap(node => {
      if (!isNested(node)) return []
      const entry = (node.config || []).find(c => c.name === 'notify')
      if (!entry) return []
      const source = entry.from === 'set' || entry.from === 'config' ? ` given by =${entry.from}` : ''
      return [
        {
          rule: NOTIFY_ATTRIBUTE_RULE_ID,
          severity: 'warning' as const,
          message: `:notify${source} is not a notification attribute; a notification is written :notice`,
          location: node.location,
        },
      ]
    }),
}
