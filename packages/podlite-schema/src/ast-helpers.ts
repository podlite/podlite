import { decodeHTMLStrict } from 'entities'
import { getTextContentFromNode } from '.'
import makeAttrsPod from './helpers/config'
import { collectText, maskText } from './helpers/handlers'
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
  // anchors the author gave other blocks, which a generated name must not take
  reserved?: Set<string>
  // everything the markdown output turns into a heading, in document order
  pageHeadings?: object[]
  // markdown only: headings the export writes a named anchor for
  named?: Set<object>
  // the number the markdown export gives each footnote, by mode
  footnotes?: Footnotes
}

type Footnotes = { production: Map<object, number>; draft: Map<object, number> }

type TreeNode = { guarded?: boolean; type?: string; name?: string; value?: unknown; content?: unknown }

const decodeEntities = (content: unknown): string =>
  Array.isArray(content)
    ? content
        .map((element: { type?: string; value?: unknown }) => {
          if (element?.type === 'number' && typeof element.value === 'number') return String.fromCharCode(element.value)
          if (element?.type === 'html_named' && typeof element.value === 'string')
            return decodeHTMLStrict(`&${element.value};`)
          return ''
        })
        .join('')
    : ''

// The text the markdown output puts into a heading, as a reader sees it. Hidden parts
// come out masked when the output masks them, and G<> masks everything written inside
// it at once. The markdown export writes nothing for E<> and Z<>, a footnote as its
// number, and S<> with unbreakable spaces, which a reader drops from the address.
const markdownText = (node: unknown, masked: boolean, footnotes: Map<object, number>, covered = false): string => {
  if (typeof node === 'string') return covered && masked ? maskText(node) : node
  if (Array.isArray(node)) return node.map(child => markdownText(child, masked, footnotes, covered)).join('')
  if (!node || typeof node !== 'object') return ''
  const n = node as TreeNode
  const hidden = covered || n.guarded === true
  if (n.type === 'fcode') {
    if (n.name === 'G' && masked) return maskText(collectText(n.content))
    if (n.name === 'E' || n.name === 'Z') return ''
    if (n.name === 'N') return String(footnotes.get(node) ?? '')
    if (n.name === 'S') return markdownText(n.content, masked, footnotes, hidden).replace(/ /g, '\u00a0')
  }
  if ((n.type === 'text' || n.type === 'verbatim') && typeof n.value === 'string')
    return hidden && masked ? maskText(n.value) : n.value
  return markdownText(n.content, masked, footnotes, hidden)
}

// Footnotes are numbered in the order the markdown export meets them in the text. It
// writes nothing for a comment or a data block, reaches a footnote inside another one
// only when the notes are written at the end, and in production a G<> writes its text
// masked and never reaches a footnote inside it. Only footnotes of the text are
// numbered here: a heading holds no note written at the end.
const numberFootnotes = (tree: unknown): Footnotes => {
  const footnotes: Footnotes = { production: new Map(), draft: new Map() }
  const visit = (node: unknown, insideGuard: boolean): void => {
    if (Array.isArray(node)) return node.forEach(child => visit(child, insideGuard))
    if (!node || typeof node !== 'object') return
    const n = node as TreeNode
    if (n.type === 'block' && (n.name === 'comment' || n.name === 'data')) return
    if (n.type === 'fcode' && n.name === 'N') {
      if (Array.isArray(n.content) && n.content.length > 0) {
        footnotes.draft.set(node, footnotes.draft.size + 1)
        if (!insideGuard) footnotes.production.set(node, footnotes.production.size + 1)
      }
      return
    }
    visit(n.content, insideGuard || (n.type === 'fcode' && n.name === 'G'))
  }
  visit(tree, false)
  return footnotes
}

// A block named in capitals comes out of the markdown export under a heading of its name.
const isSemanticBlock = (node: { type?: string; name?: unknown }): boolean =>
  node.type === 'block' &&
  typeof node.name === 'string' &&
  node.name === node.name.toUpperCase() &&
  /\p{Lu}/u.test(node.name)

const hiddenPart = (node: unknown, covered = false): string => {
  if (typeof node === 'string') return covered ? node : ''
  if (Array.isArray(node)) return node.map(child => hiddenPart(child, covered)).join('')
  if (!node || typeof node !== 'object') return ''
  const n = node as TreeNode
  const hidden = covered || n.guarded === true
  if (n.type === 'fcode' && n.name === 'E') return hidden ? decodeEntities(n.content) : ''
  if ((n.type === 'text' || n.type === 'verbatim') && typeof n.value === 'string') return hidden ? n.value : ''
  return hiddenPart(n.content, hidden)
}

// A heading hides something when a covered part of it shows a character. G<> with
// nothing inside, or with a space, hides nothing and leaves the address alone.
const hidesText = (node: unknown): boolean => /\S/.test(hiddenPart(node))

const hasExplicitId = (node: unknown): boolean =>
  !!node && typeof node === 'object' && makeAttrsPod(node as never, {}).exists('id')

// A heading whose address is not made of its text: the author named it, or its text
// is hidden. The markdown reader cannot give it that address, so the export writes one.
const hasOwnAddress = (node: unknown): boolean => hasExplicitId(node) || hidesText(node)

const walkNodes = (node: unknown, visit: (n: any) => void): void => {
  if (Array.isArray(node)) {
    for (const child of node) walkNodes(child, visit)
    return
  }
  if (!node || typeof node !== 'object') return
  visit(node)
  if ('content' in (node as any)) walkNodes((node as any).content, visit)
}

// A heading with hidden text gets a name made of nothing it hides, and it takes no
// place in the numbering of repeats: otherwise the number of an open neighbour would
// say that a hidden heading above carries the same name.
const assignAnchors = (heads: Iterable<object>, style: AnchorStyle, reserved = new Set<string>()): AnchorIndex => {
  const byNode = new Map<object, string>()
  const byName = new Map<string, string>()
  const taken = new Map<string, number>()
  const hidden: object[] = []
  for (const node of heads) {
    if (!hasExplicitId(node) && hidesText(node)) {
      // held in document order; the name comes once the open headings have theirs
      byNode.set(node, '')
      hidden.push(node)
      continue
    }
    const id = getNodeId(node, {})
    if (id == null) continue
    const name = id.toString()
    const anchor = takeUnique(style.shape(name), taken, style.firstRepeat)
    byNode.set(node, anchor)
    if (!hidesText(node) && !byName.has(name)) byName.set(name, anchor)
  }
  // A markdown reader folds case, so a generated name is kept clear of every name in
  // any case: the same name then serves both outputs.
  const inUse = new Set([...taken.keys(), ...reserved].map(name => name.toLowerCase()))
  let count = 0
  for (const node of hidden) {
    let anchor = ''
    do anchor = style.shape(`masked-${++count}`)
    while (inUse.has(anchor.toLowerCase()))
    inUse.add(anchor.toLowerCase())
    taken.set(anchor, 0)
    byNode.set(node, anchor)
  }
  return { byNode, byName, shape: style.shape, reserved }
}

// The addresses a markdown reader builds out of the headings as the page shows them,
// their numbers included, counting repeats over every heading the way github-slugger
// does: an empty name takes a place as well.
const readerSlugs = (headings: Iterable<object>, masked: boolean, footnotes?: Footnotes): string[] => {
  const numbers = (masked ? footnotes?.production : footnotes?.draft) || new Map<object, number>()
  const occurrences = new Map<string, number>()
  const slugs: string[] = []
  for (const node of headings) {
    const n = node as TreeNode & { numberPrefix?: string }
    const prefix = n.numberPrefix
    const text =
      n.name === 'head'
        ? `${prefix ? `${prefix} ` : ''}${markdownText(n.content, masked, numbers)}`.trim()
        : n.guarded === true && masked
        ? maskText(String(n.name))
        : String(n.name)
    const base = toMarkdownFragment(text)
    let slug = base
    while (occurrences.has(slug)) {
      const count = (occurrences.get(base) || 0) + 1
      occurrences.set(base, count)
      slug = `${base}-${count}`
    }
    occurrences.set(slug, 0)
    slugs.push(slug)
  }
  return slugs
}

// Anchors are handed out in one walk before rendering. A renderer asks for the
// same heading more than once — the numbering would run away — and a link may
// stand before the heading it points to, so both need the whole tree first.
export const indexAnchors = (tree: unknown, style: AnchorStyle = htmlStyle): AnchorIndex => {
  const heads: object[] = []
  const pageHeadings: object[] = []
  const reserved = new Set<string>()
  walkNodes(tree, node => {
    if (node.name === 'head') {
      heads.push(node)
      pageHeadings.push(node)
      return
    }
    if (isSemanticBlock(node)) pageHeadings.push(node)
    if (hasExplicitId(node)) {
      const written = makeAttrsPod(node, {}).getFirstValue('id')
      if (written != null) reserved.add(style.shape(String(written)))
    }
  })
  // what a markdown reader will build, so a generated name never lands on a heading
  // the reader addresses the same way. Only the masked page is read: the draft one is
  // made of the hidden text, and the name must not depend on it.
  const footnotes = numberFootnotes(tree)
  for (const slug of readerSlugs(pageHeadings, true, footnotes)) reserved.add(slug)
  return { ...assignAnchors(heads, style, reserved), pageHeadings, footnotes }
}

// The same headings in the same order, shaped for another output.
export const restyleAnchors = (index: AnchorIndex | undefined, style: AnchorStyle): AnchorIndex | undefined =>
  index && {
    ...assignAnchors(index.byNode.keys(), style, index.reserved),
    pageHeadings: index.pageHeadings,
    footnotes: index.footnotes,
  }

/*
=begin pod :kind<export>

=head2 readerAnchors

The addresses of headings in markdown output. A markdown reader builds each address
itself, out of the heading as the page shows it, so these are the addresses it will
build: the text of the heading with its number, hidden parts masked unless the mode
is C<draft>, repeats counted the way github-slugger counts them, blocks named in
capitals included, since the export writes a heading for each.

A heading the reader cannot address that way keeps the address the html output gave
it, and C<named> lists it: a hidden heading, one with an explicit C<:id>, and one
whose built address would fall on such an address. The export writes a named anchor
before each of them.

=end pod
*/
export const readerAnchors = (index: AnchorIndex | undefined, renderMode?: string): AnchorIndex | undefined => {
  if (!index) return index
  const headings = index.pageHeadings || [...index.byNode.keys()]
  const slugs = readerSlugs(headings, renderMode !== 'draft', index.footnotes)
  const slugOf = new Map<object, string>()
  headings.forEach((node, at) => slugOf.set(node, slugs[at]))
  const named = new Set<object>([...index.byNode.keys()].filter(hasOwnAddress))
  const namedAddresses = () => new Set([...named].map(node => (index.byNode.get(node) || '').toLowerCase()))
  for (let changed = true; changed; ) {
    changed = false
    const taken = namedAddresses()
    for (const node of index.byNode.keys()) {
      if (named.has(node) || !taken.has((slugOf.get(node) || '').toLowerCase())) continue
      named.add(node)
      changed = true
    }
  }
  const byNode = new Map<object, string>()
  const byName = new Map<string, string>()
  for (const [node, ownAddress] of index.byNode) {
    // lowercased: a reader such as GitHub finds a named anchor by the lowercased
    // address, and one written in capitals is not reached
    const anchor = named.has(node) ? ownAddress.toLowerCase() : slugOf.get(node) || ''
    byNode.set(node, anchor)
    const id = getNodeId(node, {})
    if (id != null && !hidesText(node) && !byName.has(id.toString())) byName.set(id.toString(), anchor)
  }
  return {
    byNode,
    byName,
    shape: toMarkdownFragment,
    reserved: index.reserved,
    pageHeadings: headings,
    named,
    footnotes: index.footnotes,
  }
}

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
    // level one has named the node; its address is the one this output gave it
    const anchor = index?.byNode.get(bound.node)
    if (anchor !== undefined) return `#${anchor}`
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
  | { found: true; document: 'self'; key: string; via: 'heading' | 'explicit-id'; ambiguous: boolean; node: object }
  | { found: false; why: 'no-target' }

export type BindingIndex = {
  byKey: Map<string, { node: object; via: 'heading' | 'explicit-id' }>
  ambiguous: Set<string>
}

// Both forms the specification describes: a section addressed by its name, and a
// block the author named with :id. The author's name wins — it was written on
// purpose, where a section name is derived from prose.
export const buildBindingIndex = (tree: unknown, style: AnchorStyle = htmlStyle): BindingIndex => {
  const byKey = new Map<string, { node: object; via: 'heading' | 'explicit-id' }>()
  const ambiguous = new Set<string>()
  const anchors = indexAnchors(tree, style)
  const put = (key: string, node: object, via: 'heading' | 'explicit-id') => {
    const known = byKey.get(key)
    if (known === undefined) {
      byKey.set(key, { node, via })
      return
    }
    if (known.node === node) return
    // Two nodes claiming one name is an ambiguity whether or not they claim it the
    // same way. An explicit id still wins the address; the flag says the document
    // said the name twice.
    ambiguous.add(key)
    if (via === 'explicit-id' && known.via !== 'explicit-id') byKey.set(key, { node, via })
  }
  // Keys come in three layers, and a lower one never takes a key a higher one holds:
  // names written as they stand, then the anchors handed out, then shaped forms.
  // Otherwise the shaped form of one heading could capture a link that names another
  // heading exactly. A collision still marks the key ambiguous.
  type Claim = [string, object, 'heading' | 'explicit-id']
  const written: Claim[] = []
  const handedOut: Claim[] = []
  const shapedForms: Claim[] = []
  walkNodes(tree, node => {
    // The raw value the author wrote, and the form the anchor takes: getExplicitNodeId
    // already turns whitespace into a hyphen, so a link written the way the id was
    // written would otherwise miss it.
    const raw = makeAttrsPod(node, {}).exists('id') ? makeAttrsPod(node, {}).getFirstValue('id') : null
    const explicit = getExplicitNodeId(node, {})
    for (const key of [raw == null ? null : String(raw), explicit]) {
      if (key) written.push([key.normalize('NFC').trim(), node, 'explicit-id'])
    }
    if (node.name !== 'head') return
    const name = getTextContentFromNode(node).normalize('NFC').trim()
    written.push([name, node, 'heading'])
    // The anchor actually handed out, which carries the number when a name repeats: a
    // link written against the second «Parameters» asks for Parameters-2, and only the
    // assignment knows that.
    const assigned = anchors.byNode.get(node)
    if (assigned) handedOut.push([assigned, node, 'heading'])
    // A heading also answers to the form an output would give it: a link copied out of
    // a rendered page carries the shaped name, and the author who pastes it means the
    // same section. Both keys name one node, so this is a second name for the target
    // rather than resolution decided by shaping.
    for (const shaped of [toFragment(name), toMarkdownFragment(name)]) {
      if (shaped && shaped !== name) shapedForms.push([shaped, node, 'heading'])
    }
  })
  for (const layer of [written, handedOut, shapedForms]) {
    for (const [key, node, via] of layer) put(key, node, via)
  }
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
  return { found: true, document: 'self', key, via: hit.via, ambiguous: index.ambiguous.has(key), node: hit.node }
}

export const getSafeNodeId = (node: Node, ctx): string | null => {
  const assigned = ctx?.__anchors?.byNode?.get(node)
  if (assigned !== undefined) return assigned
  const isHeading = typeof node === 'object' && (node as any).name === 'head'
  // a heading brought in after the index was built, as an =include drawn on the page
  // is, must not fall back to a name made of the text it hides
  if (isHeading && !hasExplicitId(node) && hidesText(node)) return null
  const id = getNodeId(node, ctx)
  if (id == null) return null
  const fragment = toFragment(id.toString())
  // only a heading derives its identifier from its own text, so only there can two
  // blocks claim the same anchor. An author-written :id is the author's business,
  // and a generated one is unique already.
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
