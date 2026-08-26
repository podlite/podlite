import { PodliteDocument, findAnchor, indexAnchors, toFragment } from '@podlite/schema'
import type { Rule, Violation, LintContext } from '../types'
import { collectExplicitIds } from './id-unique'
import { collectLinks } from './link-targets'

export const LINK_TARGET_RESOLVES_RULE_ID = 'link-target-resolves'

export const linkTargetResolvesRule: Rule = {
  id: LINK_TARGET_RESOLVES_RULE_ID,
  severity: 'error',
  check: (ast: PodliteDocument, _ctx: LintContext): Violation[] => {
    const anchors = collectLinks(ast).filter(({ target }) => target.startsWith('#'))
    if (anchors.length === 0) return []
    // Both ways an anchor can exist: written by the author as :id, or carried by a
    // heading under its own name. Matched the way the exporter matches them.
    const written = new Set(collectExplicitIds(ast).map(entry => toFragment(entry.value)))
    const headings = indexAnchors(ast)
    const resolves = (target: string): boolean => {
      const name = target.slice(1)
      return written.has(toFragment(name)) || findAnchor(name, headings) !== undefined
    }
    return anchors
      .filter(({ target }) => !resolves(target))
      .map(({ target, at }) => ({
        rule: LINK_TARGET_RESOLVES_RULE_ID,
        severity: 'error' as const,
        message: `Link target ${target} matches no :id and no heading`,
        location: at,
      }))
  },
}
