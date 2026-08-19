import { getFromTree } from '@podlite/schema'
import type { Location, PodliteDocument } from '@podlite/schema'
import type { Violation } from './types'

export const LINT_IGNORE_RULE_ID = 'lint-ignore'
const ATTR = 'lint-ignore'

type Mute = { rules: string[]; location: Location; used: Set<string> }

const valuesOf = (config: unknown): string[] | null => {
  if (!Array.isArray(config)) return null
  const item = config.find(c => c && typeof c === 'object' && (c as { name?: string }).name === ATTR) as
    | { value?: unknown }
    | undefined
  if (!item) return null
  const value = item.value
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string') return value.split(/\s+/).filter(Boolean)
  return []
}

const covers = (mute: Mute, violation: Violation): boolean => {
  const at = violation.location?.start.offset
  if (at === undefined) return false
  return at >= mute.location.start.offset && at <= mute.location.end.offset
}

export function collectMutes(ast: PodliteDocument): { mutes: Mute[]; empty: Location[] } {
  const nodes = getFromTree(ast, () => true) as Array<{ config?: unknown; location?: Location }>
  const mutes: Mute[] = []
  const empty: Location[] = []
  for (const node of nodes) {
    if (!node || !node.location) continue
    const rules = valuesOf(node.config)
    if (rules === null) continue
    if (rules.length === 0) {
      empty.push(node.location)
      continue
    }
    mutes.push({ rules, location: node.location, used: new Set<string>() })
  }
  return { mutes, empty }
}

// A mute names the rules it silences: a bare attribute would cover everything,
// and a mute that never fires is a leftover the author cannot see otherwise.
export function applyMutes(violations: Violation[], ast: PodliteDocument): { kept: Violation[]; silenced: number } {
  const { mutes, empty } = collectMutes(ast)
  if (mutes.length === 0 && empty.length === 0) return { kept: violations, silenced: 0 }

  const kept = violations.filter(violation => {
    const mute = mutes.find(m => m.rules.includes(violation.rule) && covers(m, violation))
    if (!mute) return true
    mute.used.add(violation.rule)
    return false
  })

  for (const location of empty) {
    kept.push({
      rule: LINT_IGNORE_RULE_ID,
      severity: 'warning',
      message: `:${ATTR} names no rule; write the rule slugs it should silence`,
      location,
    })
  }
  for (const mute of mutes) {
    const idle = mute.rules.filter(rule => !mute.used.has(rule))
    if (idle.length === 0) continue
    kept.push({
      rule: LINT_IGNORE_RULE_ID,
      severity: 'warning',
      message: `:${ATTR}<${idle.join(' ')}> silenced nothing here`,
      location: mute.location,
    })
  }
  return { kept, silenced: violations.length - kept.filter(v => v.rule !== LINT_IGNORE_RULE_ID).length }
}
