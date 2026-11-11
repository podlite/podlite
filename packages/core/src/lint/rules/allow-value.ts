import { getFromTree, isMarkupCodeLetter, isNamedBlockName, PodliteDocument } from '@podlite/schema'
import type { Rule, Violation, LintContext } from '../types'

export const ALLOW_VALUE_RULE_ID = 'allow-value'

type ConfigEntry = { name?: string; from?: string; value?: unknown; dropped?: boolean }
type BlockNode = { type?: string; name?: string; config?: unknown; location?: Violation['location'] }

const shown = (item: unknown): string => (typeof item === 'string' ? JSON.stringify(item) : String(item))

// what is wrong with one :allow value, or nothing; a string is one item, since the
// parser keeps a value it could not split as it was written
const problemOf = (value: unknown): string | null => {
  // :!allow and an empty list name no code
  if (value === false) return null
  const items = Array.isArray(value) ? value : typeof value === 'string' ? [value] : null
  if (!items) return ':allow takes a list of markup code letters, as in :allow<B I>; this value allows no code'
  const wrong = items.filter(item => !isMarkupCodeLetter(item))
  if (wrong.length === 0) return null
  const named = wrong.map(shown).join(', ')
  return `:allow holds ${named}: a markup code is named by one letter, and the codes are listed with spaces, as in :allow<B I>; ${named} allows no code`
}

// =config and =set keep no place of their own, so the blocks they reached carry the report
const sources: Array<string | undefined> = [undefined, 'config', 'set']

// the handler of a named block decides what its :allow means
const receives = (node: BlockNode): boolean =>
  node.type === 'para' || node.type === 'code' || (node.type === 'block' && !isNamedBlockName(node.name || ''))

export const allowValueRule: Rule = {
  id: ALLOW_VALUE_RULE_ID,
  severity: 'warning',
  check: (ast: PodliteDocument, _ctx: LintContext): Violation[] =>
    getFromTree(ast, () => true).flatMap(node => {
      const block = node as BlockNode
      // the cells a table makes carry a copy of :allow with no place of their own
      if (!block || !block.location || !Array.isArray(block.config) || !receives(block)) return []
      return (block.config as ConfigEntry[])
        .filter(entry => entry && entry.name === 'allow' && !entry.dropped && sources.includes(entry.from))
        .flatMap(entry => {
          const problem = problemOf(entry.value)
          if (!problem) return []
          const message = entry.from ? problem.replace(/^:allow/, `:allow given by =${entry.from}`) : problem
          return [{ rule: ALLOW_VALUE_RULE_ID, severity: 'warning' as const, message, location: block.location }]
        })
    }),
}
