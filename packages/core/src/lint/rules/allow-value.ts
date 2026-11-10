import { getFromTree, isMarkupCodeLetter, isNamedBlockName, PodliteDocument } from '@podlite/schema'
import type { Rule, Violation, LintContext } from '../types'

export const ALLOW_VALUE_RULE_ID = 'allow-value'

type ConfigEntry = { name?: string; from?: string; value?: unknown }
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

// Only what is written on a block is read: a value from =config or =set reaches the
// block marked by where it came from, and the cells a table makes carry a copy with
// no place of their own. The handler of a named block decides what its :allow means.
export const allowValueRule: Rule = {
  id: ALLOW_VALUE_RULE_ID,
  severity: 'warning',
  check: (ast: PodliteDocument, _ctx: LintContext): Violation[] =>
    getFromTree(ast, () => true).flatMap(node => {
      const block = node as BlockNode
      if (!block || block.type !== 'block' || !block.location || !Array.isArray(block.config)) return []
      if (isNamedBlockName(block.name || '')) return []
      return (block.config as ConfigEntry[])
        .filter(entry => entry && entry.name === 'allow' && !entry.from)
        .flatMap(entry => {
          const message = problemOf(entry.value)
          return message
            ? [{ rule: ALLOW_VALUE_RULE_ID, severity: 'warning' as const, message, location: block.location }]
            : []
        })
    }),
}
