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

// Level two: the address, shaped for this format. It is asked for only once level
// one has said the link points at something. A refusal comes back as undefined, and
// a link with no address is what the reader gets — not an address to nowhere.
export const sameDocTarget = <T>(
  target: T,
  ctx,
  index: AnchorIndex | undefined = ctx?.__anchors,
): T | string | undefined => {
  if (typeof target !== 'string' || !target.startsWith('#') || target === '#') return target
  const shape = index?.shape || toFragment
  const bindings: BindingIndex | undefined = ctx?.__bindings
  if (bindings) {
    const bound = bindTarget(target.slice(1), bindings)
    if (!bound.found) return undefined
    return `#${bound.via === 'heading' ? resolveFragment(bound.key, index) : shape(bound.key)}`
  }
  return `#${resolveFragment(target.slice(1), index)}`
}

// A link written without a bar keeps its target in the content, and by the time a
// renderer sees it the content is a node array. Only the first node is read; a
// target spread over several nodes is a separate question.
export const linkTarget = (node: { meta?: unknown; content?: unknown }): string | undefined => {
  if (typeof node.meta === 'string') return node.meta
  const content = node.content
  const first = Array.isArray(content) ? content[0] : content
  if (typeof first === 'string') return first
  if (first && typeof first === 'object' && 'value' in first) {
    const { value } = first as { value?: unknown }
    if (typeof value === 'string') return value
  }
  return undefined
}

// An attribute written without a value reaches the node as a boolean, which is the
// reader reporting that nothing was written rather than the author writing it. A
// number is a value the author did write, and stays.
export const writtenValue = (value: unknown): string | undefined =>
  value == null || typeof value === 'boolean' ? undefined : String(value)

// Level one: what a link points at, answered on the tree and before any shaping.
// A refusal is part of the answer — an address invented for a target that is not
// there is how a broken link used to reach the output looking like a working one.
export type LinkBinding =
  | { found: true; document: 'self'; key: string; via: 'heading' | 'explicit-id'; ambiguous: boolean }
  | { found: false; why: 'no-target' }

export type BindingIndex = { byKey: Map<string, { node: object; via: 'heading' | 'explicit-id' }>; ambiguous: Set<string> }

// Both forms the specification describes: a section addressed by its name, and a
// block the author named with :id. The author's name wins — it was written on
// purpose, where a section name is derived from prose.
export const buildBindingIndex = (tree: unknown, style: AnchorStyle = htmlStyle): BindingIndex => {
  const byKey = new Map<string, { node: object; via: 'heading' | 'explicit-id' }>()
  const ambiguous = new Set<string>()
  const put = (key: string, node: object, via: 'heading' | 'explicit-id') => {
    const known = byKey.get(key)
    if (known === undefined) {
      byKey.set(key, { node, via })
      return
    }
    if (known.node === node) return
    if (known.via === via) ambiguous.add(key)
    else if (via === 'explicit-id') byKey.set(key, { node, via })
  }
  walkNodes(tree, node => {
    const explicit = getExplicitNodeId(node, {})
    if (explicit) put(explicit.normalize('NFC').trim(), node, 'explicit-id')
    if (node.name !== 'head') return
    const name = getTextContentFromNode(node).normalize('NFC').trim()
    put(name, node, 'heading')
    // A heading answers to its own name and to the form an output would give it: a
    // link copied out of a rendered page carries the shaped name, and the author who
    // pastes it means the same section. Both keys name one node, so this is a second
    // name for the target rather than resolution decided by shaping.
    for (const shaped of [toFragment(name), toMarkdownFragment(name)]) {
      if (shaped && shaped !== name) put(shaped, node, 'heading')
    }
  })
  return { byKey, ambiguous }
}

// Matching is exact: level one has to keep apart everything the tree keeps apart,
// and folding case would erase that. Measured over the knowledge base — no working
// link depended on a case-folded match.
export const bindTarget = (target: string, index?: BindingIndex): LinkBinding => {
  const key = target.normalize('NFC').trim()
  if (!index) return { found: false, why: 'no-target' }
  const hit = index.byKey.get(key)
  if (!hit) return { found: false, why: 'no-target' }
  // Two targets of one name is a fact about the document, not a reason to refuse it
  // an address: the first still answers, as it always has, and the ambiguity travels
  // with the answer for whoever reports it.
  return { found: true, document: 'self', key, via: hit.via, ambiguous: index.ambiguous.has(key) }
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
