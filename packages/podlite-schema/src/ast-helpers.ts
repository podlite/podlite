import { getTextContentFromNode } from '.'
import makeAttrsPod from './helpers/config'
import { Node } from './types'

export const getNodeId = (node, ctx) => {
  const conf = makeAttrsPod(node, ctx)
  if (conf.exists('id')) {
    return conf.getFirstValue('id')
  }
  return node.id
}
// Shapes an identifier for an output format: whitespace and dashes collapse into a
// single hyphen, punctuation and back-ticks go, case and non-latin letters stay.
// Same rule as Swift DocC — readable fragments instead of percent-escaped ones.
export const toFragment = (value: string): string => {
  const collapsed = value
    .trim()
    .split(/[\s\-\u2013\u2014]+/)
    .filter(Boolean)
    .join('-')
  const cleaned = collapsed.replace(/[^\p{L}\p{N}\-_]/gu, '')
  return cleaned.replace(/^-+|-+$/g, '')
}

// Repeated names would otherwise share one anchor: seventeen headings once
// collapsed onto a single «infix». The counter lives in the render context, so
// numbering restarts per document.
const takeUnique = (fragment: string, ctx): string => {
  if (!fragment) return fragment
  const seen: Map<string, number> = ctx && typeof ctx === 'object' ? (ctx.__fragments ||= new Map()) : new Map()
  const used = seen.get(fragment)
  if (used === undefined) {
    seen.set(fragment, 1)
    return fragment
  }
  const next = used + 1
  seen.set(fragment, next)
  return `${fragment}-${next}`
}

export const getSafeNodeId = (node: Node, ctx): string | null => {
  const id = getNodeId(node, ctx)
  if (id == null) return null
  const fragment = toFragment(id.toString())
  // only a heading derives its identifier from its own text, so only there can two
  // blocks claim the same anchor. An author-written :id is the author's business,
  // and a generated one is unique already.
  const isHeading = typeof node === 'object' && (node as any).name === 'head'
  return isHeading ? takeUnique(fragment, ctx) : fragment
}

// Only the author-written :id. The generated node.id changes on every parse, so
// emitting it as an html anchor would produce targets no link can rely on.
export const getExplicitNodeId = (node, ctx): string | null => {
  const conf = makeAttrsPod(node, ctx)
  if (!conf.exists('id')) return null
  const id = conf.getFirstValue('id')
  return id == null ? null : id.toString().replace(/\s/g, '-')
}

export const makeAttrs = makeAttrsPod
