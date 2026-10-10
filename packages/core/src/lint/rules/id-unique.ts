import { getFromTree, PodliteDocument } from '@podlite/schema'
import type { Rule, Violation, LintContext } from '../types'
import type { IncludeOrigin } from '../../assemble'
import { assembleForLint, includedName } from './include-resolves'

export const ID_UNIQUE_RULE_ID = 'id-unique'

type IdEntry = { value: string; location?: Violation['location']; node?: object }

// =config gives settings, it places no block, so its :id is not an occurrence
const isDirective = (node: { type?: string }): boolean => node.type === 'config'

export function collectExplicitIds(ast: PodliteDocument): IdEntry[] {
  const nodes = getFromTree(ast, () => true) as Array<{
    type?: string
    config?: Array<{ name?: string; value?: unknown }>
    location?: Violation['location']
  }>
  const entries: IdEntry[] = []
  for (const node of nodes) {
    if (isDirective(node)) continue
    const config = Array.isArray(node.config) ? node.config : []
    for (const item of config) {
      if (item && item.name === 'id' && item.value !== undefined && item.value !== null) {
        entries.push({ value: String(item.value), location: node.location, node })
      }
    }
  }
  return entries
}

// Where an occurrence stands in this file, and where it was written when an
// include brought it: a block from another file is reported at the directive
// of this file it came through, as include-resolves reports.
const placeOf = (entry: IdEntry, origin: WeakMap<object, IncludeOrigin> | undefined, ctx: LintContext) => {
  const from = entry.node && origin?.get(entry.node)
  const step = from?.steps?.[0]
  if (!from || !step) return { location: entry.location, written: undefined }
  const line = entry.location ? `:${entry.location.start.line}` : ''
  return { location: step.location, written: `${includedName(from.file, ctx)}${line}` }
}

export const idUniqueRule: Rule = {
  id: ID_UNIQUE_RULE_ID,
  severity: 'error',
  check: (ast: PodliteDocument, ctx: LintContext): Violation[] => {
    const assembled = assembleForLint(ast, ctx)
    const whole = assembled && !(assembled instanceof Error) ? assembled : undefined
    const entries = collectExplicitIds(whole ? whole.tree : ast)
    if (entries.length === 0) return []
    const first = new Map<string, ReturnType<typeof placeOf>>()
    const violations: Violation[] = []
    for (const entry of entries) {
      const place = placeOf(entry, whole?.origin, ctx)
      const earlier = first.get(entry.value)
      if (!earlier) {
        first.set(entry.value, place)
        continue
      }
      const crossed = place.written !== undefined || earlier.written !== undefined
      const here = (p: typeof place) => `line ${p.location?.start.line ?? '?'}${p.written ? ` (in ${p.written})` : ''}`
      violations.push({
        rule: ID_UNIQUE_RULE_ID,
        severity: 'error',
        message: crossed
          ? `Duplicate :id<${entry.value}>${place.written ? ` (in ${place.written})` : ''}; first at ${here(earlier)}`
          : `Duplicate :id<${entry.value}>`,
        location: place.location,
      })
    }
    return violations
  },
}
