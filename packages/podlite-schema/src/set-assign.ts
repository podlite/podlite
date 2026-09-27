/*
=begin pod :kind<module>

=head2 set-assign

How C<=set> assignments reach a block when an C<=include> stands between them:
the target is chosen in the content the include resolves to.

=end pod
*/
import { ConfigItem } from './types'
import { markGuarded } from './guard'

// Directives and =comment blocks pass =set attributes through to the next
// block instead of consuming them.
export const isSetTransparent = (node: any): boolean => {
  if (!node || typeof node !== 'object') return false
  if (node.type === 'set' || node.type === 'config' || node.type === 'alias' || node.type === 'blankline') return true
  if (node.type === 'block' && (node.name === 'comment' || node.name === 'boundary' || node.name === 'include'))
    return true
  return false
}

// wrappers the tree adds around written blocks: the search goes inside them
const isWrapper = (node: any): boolean =>
  node && typeof node === 'object' && node.type === 'block' && (node.name === 'root' || node.name === '_folded_section')

const isInclude = (node: any): boolean =>
  node && typeof node === 'object' && node.type === 'block' && node.name === 'include'

/*
=begin pod :kind<export>

=head2 mergeSet

Joins two lists of assignments of one key-space: an item of C<later> replaces an
item of the same name in C<earlier>, and the order of first appearance is kept.

=end pod
*/
export const mergeSet = (earlier: ConfigItem[] | undefined, later: ConfigItem[] | undefined): ConfigItem[] => {
  const out = [...(earlier || [])]
  for (const item of later || []) {
    const at = out.findIndex(c => c.name === item.name)
    if (at === -1) out.push(item)
    else out[at] = item
  }
  return out
}

// What an assignment may replace on the block it reaches: only a =config
// default. A =set already on the block was written nearer to it, in the file
// the block comes from or after the include.
const replaceable = (item: any): boolean => item && item.from === 'config'

const assign = (config: any[] | undefined, set: ConfigItem[]): any[] => {
  const out = [...(config || [])]
  for (const item of set) {
    const at = out.findIndex(c => c && c.name === item.name)
    const marked = { ...item, from: 'set' as const }
    if (at === -1) out.push(marked)
    else if (replaceable(out[at])) out[at] = marked
  }
  return out
}

// a copy of a node and all below it, each copy keeping the origin of the node it
// replaces
type Copied = (from: object, to: object) => void

const deepCopy = (node: any, origin?: WeakMap<object, any>, onCopy?: Copied): any => {
  if (Array.isArray(node)) return node.map(n => deepCopy(n, origin, onCopy))
  if (!node || typeof node !== 'object') return node
  const copy: any = { ...node }
  if (node.content !== undefined) copy.content = deepCopy(node.content, origin, onCopy)
  if (node.caption !== undefined && typeof node.caption === 'object')
    copy.caption = deepCopy(node.caption, origin, onCopy)
  const known = origin?.get(node)
  if (origin && known) origin.set(copy, known)
  onCopy?.(node, copy)
  return copy
}

export type SetOutcome = 'block' | 'include' | 'none'

/*
=begin pod :kind<export>

=head2 applySetToFirst

Gives C<set> to the first block of C<nodes> that is not transparent to C<=set>
targeting, looking inside the wrappers the tree adds (C<root>,
C<_folded_section>). The nodes given are not changed: the path to the target and
the target's subtree are copied, C<origin>, when given, is carried to the
copies, and C<onCopy> is told of each copy in the target's subtree. An C<=include> met first, not yet resolved, takes the assignments into its
own C<set>, where they wait for its content; those of the same name already there
were written nearer to that content and stay.

An item replaces only a C<=config> default: an attribute written on the block
and a C<=set> already on it are kept. C<mode> names where the nodes come from,
the content an include brings or the block that follows an include with no
target; both are treated alike.

Returns the nodes and where the assignments went: C<'block'>, C<'include'> or
C<'none'>.

=end pod
*/
export const applySetToFirst = (
  nodes: any[],
  set: ConfigItem[],
  options: { mode: 'include' | 'carry'; origin?: WeakMap<object, any>; onCopy?: Copied },
): { nodes: any[]; outcome: SetOutcome } => {
  const { origin, onCopy } = options
  const out = [...nodes]
  for (let i = 0; i < out.length; i++) {
    const node = out[i]
    if (!node || typeof node !== 'object') continue
    if (isInclude(node)) {
      out[i] = { ...node, set: mergeSet(set, node.set) }
      const known = origin?.get(node)
      if (origin && known) origin.set(out[i], known)
      return { nodes: out, outcome: 'include' }
    }
    if (isWrapper(node)) {
      const inner = Array.isArray(node.content) ? node.content : node.content ? [node.content] : []
      const found = applySetToFirst(inner, set, options)
      if (found.outcome === 'none') continue
      out[i] = { ...node, content: Array.isArray(node.content) ? found.nodes : found.nodes[0] }
      const known = origin?.get(node)
      if (origin && known) origin.set(out[i], known)
      return { nodes: out, outcome: found.outcome }
    }
    if (node.type !== 'block' || isSetTransparent(node)) continue
    const copy = deepCopy(node, origin, onCopy)
    copy.config = assign(node.config, set)
    markGuarded(copy)
    out[i] = copy
    return { nodes: out, outcome: 'block' }
  }
  return { nodes: out, outcome: 'none' }
}
