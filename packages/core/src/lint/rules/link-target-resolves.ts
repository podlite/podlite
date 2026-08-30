import { PodliteDocument, bindTarget, buildBindingIndex } from '@podlite/schema'
import type { Rule, Violation, LintContext } from '../types'
import { collectLinks } from './link-targets'

export const LINK_TARGET_RESOLVES_RULE_ID = 'link-target-resolves'

export const linkTargetResolvesRule: Rule = {
  id: LINK_TARGET_RESOLVES_RULE_ID,
  severity: 'error',
  check: (ast: PodliteDocument, _ctx: LintContext): Violation[] => {
    // A bare # is left alone by the export — it is not a target and not a mistake —
    // so the rule has nothing to say about it either.
    const anchors = collectLinks(ast).filter(({ target }) => target.startsWith('#') && target !== '#')
    if (anchors.length === 0) return []
    // Both ways an anchor can exist: written by the author as :id, or carried by a
    // heading under its own name. Matched the way the exporter matches them.
    // Asked of the same binding the exporters ask, rather than worked out again here.
    // Two answers to one question is how this rule came to call a link sound that the
    // export could not resolve: it shaped both sides itself, and the export did not.
    const index = buildBindingIndex(ast)
    const resolves = (target: string): boolean => bindTarget(target.slice(1), index).found
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
