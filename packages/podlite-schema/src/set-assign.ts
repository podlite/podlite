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

// What an assignment may replace on the block it reaches: from the content an
// include brings, a =set of that file and a =config default; carried past an
// include with no target, only a default, since a later =set of the block's own
// file already stands on it.
const replaceable = (item: any, mode: 'include' | 'carry'): boolean =>
  item && (item.from === 'config' || (mode === 'include' && item.from === 'set'))

const assign = (config: any[] | undefined, set: ConfigItem[], mode: 'include' | 'carry'): any[] => {
  const out = [...(config || [])]
  for (const item of set) {
    const at = out.findIndex(c => c && c.name === item.name)
    const marked = { ...item, from: 'set' as const }
    if (at === -1) out.push(marked)
    else if (replaceable(out[at], mode)) out[at] = marked
  }
  return out
}

// a copy of a node and all below it, each copy keeping the origin of the node it
// replaces
const deepCopy = (node: any, origin?: WeakMap<object, any>): any => {
  if (Array.isArray(node)) return node.map(n => deepCopy(n, origin))
  if (!node || typeof node !== 'object') return node
  const copy: any = { ...node }
  if (node.content !== undefined) copy.content = deepCopy(node.content, origin)
  if (node.caption !== undefined && typeof node.caption === 'object') copy.caption = deepCopy(node.caption, origin)
  const known = origin?.get(node)
  if (origin && known) origin.set(copy, known)
  return copy
}

export type SetOutcome = 'block' | 'include' | 'none'

/*
=begin pod :kind<export>

=head2 applySetToFirst

Gives C<set> to the first block of C<nodes> that is not transparent to C<=set>
targeting, looking inside the wrappers the tree adds (C<root>,
C<_folded_section>). The nodes given are not changed: the path to the target and
the target's subtree are copied, and C<origin>, when given, is carried to the
copies. An C<=include> met first, not yet resolved, takes the assignments into its
own C<set>, where they wait for its content; those already there are later and
win.

C<mode> C<'include'> is for the content an include brings: an item replaces one
that came from a C<=set> or C<=config> of that content. C<'carry'> is for the block
that follows an include with no target: an item replaces only a C<=config>
default. A written attribute is never replaced.

Returns the nodes and where the assignments went: C<'block'>, C<'include'> or
C<'none'>.

=end pod
*/
export const applySetToFirst = (
  nodes: any[],
  set: ConfigItem[],
  options: { mode: 'include' | 'carry'; origin?: WeakMap<object, any> },
): { nodes: any[]; outcome: SetOutcome } => {
  const { mode, origin } = options
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
    const copy = deepCopy(node, origin)
    copy.config = assign(node.config, set, mode)
    markGuarded(copy)
    out[i] = copy
    return { nodes: out, outcome: 'block' }
  }
  return { nodes: out, outcome: 'none' }
}
