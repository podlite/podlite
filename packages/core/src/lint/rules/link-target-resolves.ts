import { PodliteDocument, findAnchor, indexAnchors, toFragment } from '@podlite/schema'
import type { Rule, Violation, LintContext } from '../types'
import { collectExplicitIds } from './id-unique'

export const LINK_TARGET_RESOLVES_RULE_ID = 'link-target-resolves'

type LinkNode = {
  name?: string
  meta?: string | null
  content?: unknown
  location?: Violation['location']
}

// A link without display text carries the target in its content instead of meta.
const linkTarget = (node: LinkNode): string => {
  if (typeof node.meta === 'string') return node.meta.trim()
  const content = Array.isArray(node.content) ? node.content : []
  const first = content[0]
  return typeof first === 'string' ? first.trim() : ''
}

// Inline nodes carry no location, so the nearest enclosing block supplies one.
const collectAnchors = (
  node: unknown,
  at?: Violation['location'],
): Array<{ target: string; at?: Violation['location'] }> => {
  if (Array.isArray(node)) return node.flatMap(child => collectAnchors(child, at))
  if (!node || typeof node !== 'object') return []
  const n = node as LinkNode & { type?: string; location?: Violation['location'] }
  const here = n.location || at
  const found = n.type === 'fcode' && (n.name === 'L' || n.name === 'W') ? [{ target: linkTarget(n), at: here }] : []
  return [...found, ...collectAnchors(n.content, here)]
}

export const linkTargetResolvesRule: Rule = {
  id: LINK_TARGET_RESOLVES_RULE_ID,
  severity: 'error',
  check: (ast: PodliteDocument, _ctx: LintContext): Violation[] => {
    const anchors = collectAnchors(ast).filter(({ target }) => target.startsWith('#'))
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
