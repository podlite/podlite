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

// What a markdown reader will build out of the heading itself: nothing is
// collapsed and no edge is trimmed, so «infix //» becomes «infix-». Matched
// against github-slugger on the whole Raku corpus.
export const toMarkdownFragment = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{Nd}\p{Nl}\-_ ]/gu, '')
    .replace(/ /g, '-')

export type AnchorStyle = {
  shape: (value: string) => string
  // the number the second heading of the same shape gets
  firstRepeat: number
}

export const htmlStyle: AnchorStyle = { shape: toFragment, firstRepeat: 2 }
export const markdownStyle: AnchorStyle = { shape: toMarkdownFragment, firstRepeat: 1 }

// Repeated names would otherwise share one anchor: seventeen headings once
// collapsed onto a single «infix».
const takeUnique = (fragment: string, taken: Map<string, number>, firstRepeat: number): string => {
  if (!fragment) return fragment
  let result = fragment
  while (taken.has(result)) {
    const used = (taken.get(fragment) || 0) + 1
    taken.set(fragment, used)
    result = `${fragment}-${used + firstRepeat - 1}`
  }
  taken.set(result, taken.get(result) || 0)
  return result
}

export type AnchorIndex = {
  byNode: Map<object, string>
  byName: Map<string, string>
  shape: (value: string) => string
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

const assignAnchors = (heads: Iterable<object>, style: AnchorStyle): AnchorIndex => {
  const byNode = new Map<object, string>()
  const byName = new Map<string, string>()
  const taken = new Map<string, number>()
  for (const node of heads) {
    const id = getNodeId(node, {})
    if (id == null) continue
    const name = id.toString()
    const anchor = takeUnique(style.shape(name), taken, style.firstRepeat)
    byNode.set(node, anchor)
    if (!byName.has(name)) byName.set(name, anchor)
  }
  return { byNode, byName, shape: style.shape }
}

// Anchors are handed out in one walk before rendering. A renderer asks for the
// same heading more than once — the numbering would run away — and a link may
// stand before the heading it points to, so both need the whole tree first.
export const indexAnchors = (tree: unknown, style: AnchorStyle = htmlStyle): AnchorIndex => {
  const heads: object[] = []
  walkNodes(tree, node => {
    if (node.name === 'head') heads.push(node)
  })
  return assignAnchors(heads, style)
}

// The same headings in the same order, shaped for another output.
export const restyleAnchors = (index: AnchorIndex | undefined, style: AnchorStyle): AnchorIndex | undefined =>
  index && assignAnchors(index.byNode.keys(), style)

// Exact name first, then without regard to case: a link copied from markdown
// carries a lowercased target, and one written by hand carries the name itself.
export const findAnchor = (target: string, index?: AnchorIndex): string | undefined => {
  const name = target.trim()
  if (!index || index.byName.size === 0) return undefined
  const exact = index.byName.get(name)
  if (exact !== undefined) return exact
  const wanted = [name.toLowerCase(), index.shape(name).toLowerCase()]
  for (const [heading, anchor] of index.byName) {
    if (wanted.includes(heading.toLowerCase()) || wanted.includes(anchor.toLowerCase())) return anchor
  }
  return undefined
}

export const resolveFragment = (target: string, index?: AnchorIndex): string =>
  findAnchor(target, index) ?? (index?.shape || toFragment)(target)

// A link inside the same document points at a heading by name, so it goes through
// the rules that shaped that heading's anchor.
export const sameDocTarget = <T>(target: T, ctx, index: AnchorIndex | undefined = ctx?.__anchors): T | string => {
  if (typeof target !== 'string' || !target.startsWith('#') || target === '#') return target
  return `#${resolveFragment(target.slice(1), index)}`
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
  return takeUnique(fragment, taken, htmlStyle.firstRepeat)
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
