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
// collapsed onto a single «infix».
const takeUnique = (fragment: string, taken: Map<string, number>): string => {
  if (!fragment) return fragment
  const used = taken.get(fragment)
  if (used === undefined) {
    taken.set(fragment, 1)
    return fragment
  }
  const next = used + 1
  taken.set(fragment, next)
  return `${fragment}-${next}`
}

export type AnchorIndex = {
  byNode: Map<object, string>
  byName: Map<string, string>
}

const walkNodes = (node: unknown, visit: (n: any) => void): void => {
  if (Array.isArray(node)) {
    for (const child of node) walkNodes(child, visit)
    return
  }
  if (!node || typeof node !== 'object') return
  visit(node)
  if ('content' in (node as any)) walkNodes((node as any).content, visit)
}

// Anchors are handed out in one walk before rendering. A renderer asks for the
// same heading more than once — the numbering would run away — and a link may
// stand before the heading it points to, so both need the whole tree first.
export const indexAnchors = (tree: unknown): AnchorIndex => {
  const byNode = new Map<object, string>()
  const byName = new Map<string, string>()
  const taken = new Map<string, number>()
  walkNodes(tree, node => {
    if (node.name !== 'head') return
    const id = getNodeId(node, {})
    if (id == null) return
    const name = id.toString()
    const anchor = takeUnique(toFragment(name), taken)
    byNode.set(node, anchor)
    if (!byName.has(name)) byName.set(name, anchor)
  })
  return { byNode, byName }
}

// Exact name first, then without regard to case: a link copied from markdown
// carries a lowercased target, and one written by hand carries the name itself.
export const findAnchor = (target: string, index?: AnchorIndex): string | undefined => {
  const name = target.trim()
  if (!index || index.byName.size === 0) return undefined
  const exact = index.byName.get(name)
  if (exact !== undefined) return exact
  const wanted = [name.toLowerCase(), toFragment(name).toLowerCase()]
  for (const [heading, anchor] of index.byName) {
    if (wanted.includes(heading.toLowerCase()) || wanted.includes(anchor.toLowerCase())) return anchor
  }
  return undefined
}

export const resolveFragment = (target: string, index?: AnchorIndex): string =>
  findAnchor(target, index) ?? toFragment(target)

// A link inside the same document points at a heading by name, so it goes through
// the rules that shaped that heading's anchor.
export const sameDocTarget = <T>(target: T, ctx): T | string => {
  if (typeof target !== 'string' || !target.startsWith('#') || target === '#') return target
  return `#${resolveFragment(target.slice(1), ctx?.__anchors)}`
}

export const getSafeNodeId = (node: Node, ctx): string | null => {
  const assigned = ctx?.__anchors?.byNode?.get(node)
  if (assigned !== undefined) return assigned
  const id = getNodeId(node, ctx)
  if (id == null) return null
  const fragment = toFragment(id.toString())
  // only a heading derives its identifier from its own text, so only there can two
  // blocks claim the same anchor. An author-written :id is the author's business,
  // and a generated one is unique already.
  const isHeading = typeof node === 'object' && (node as any).name === 'head'
  if (!isHeading) return fragment
  const taken: Map<string, number> = ctx && typeof ctx === 'object' ? (ctx.__fragments ||= new Map()) : new Map()
  return takeUnique(fragment, taken)
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
