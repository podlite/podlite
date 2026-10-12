import makeAttrs from './helpers/config'
import { maskText } from './helpers/handlers'

// Covered content is marked on the node, not decided at render time. A block
// carrying :masked or a G<> code can be lifted out of its document by =include,
// by a data: reference, by an alias expansion or by a selector; the mark travels
// with the node, so whatever pulls the node out cannot strip the cover off it.
const GUARD_CODE = 'G'

const isGuardCode = (node: { type?: string; name?: string }): boolean =>
  node.type === 'fcode' && node.name === GUARD_CODE

// a paragraph or code written without a marker is masked by the settings it was given
const isMaskedBlock = (node: { type?: string }): boolean => {
  if (node.type !== 'block' && node.type !== 'para' && node.type !== 'code') return false
  const conf = makeAttrs(node as never, {})
  return conf.exists('masked') && Boolean(conf.getFirstValue('masked'))
}

// The mark says the content is covered; the render mode says whether the cover
// is applied. Draft shows what production hides, and the mark alone must not
// override that.
export const isCovered = (node: unknown, ctx?: { maskMode?: boolean; renderMode?: string }): boolean => {
  if (ctx?.maskMode) return true
  if (ctx?.renderMode === 'draft') return false
  return Boolean((node as { guarded?: boolean })?.guarded)
}

const isCaptionNode = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  'type' in value &&
  value.type === 'block' &&
  'name' in value &&
  value.name === 'caption'

export const markGuarded = <T>(node: T, inherited = false): T => {
  if (!node || typeof node !== 'object') return node
  if (Array.isArray(node)) {
    node.forEach(child => markGuarded(child, inherited))
    return node
  }
  const target = node as { content?: unknown; guarded?: boolean; type?: string; name?: string }
  const covered = inherited || target.guarded === true || isGuardCode(target) || isMaskedBlock(target)
  if (covered) target.guarded = true
  if (Array.isArray(target.content)) target.content.forEach(child => markGuarded(child, covered))
  // a caption parsed from an attribute value sits beside the content, not in it
  if ('caption' in target && isCaptionNode(target.caption)) markGuarded(target.caption, covered)
  return node
}

/*
=begin pod :kind<export>

=head2 guardedTextLeaves

The text of a node as the pieces it is made of, in order, each with whether it is
hidden. It reads what C<getTextContentFromNode> reads: text and verbatim leaves and
plain strings, through content held as an array or as a single node, and not a
caption. A leaf is hidden when it or any node above it is a C<G<>> code or carries
the mark of hidden content, so a leaf the mark did not reach is still reported
hidden.

=end pod
*/
export const guardedTextLeaves = (node: unknown): Array<{ value: string; guarded: boolean }> => {
  const leaves: Array<{ value: string; guarded: boolean }> = []
  const walk = (value: unknown, covered: boolean): void => {
    if (Array.isArray(value)) {
      value.forEach(item => walk(item, covered))
      return
    }
    if (typeof value === 'string') {
      leaves.push({ value, guarded: covered })
      return
    }
    if (!value || typeof value !== 'object') return
    const target = value as { type?: string; name?: string; value?: unknown; content?: unknown; guarded?: boolean }
    const hidden = covered || target.guarded === true || isGuardCode(target) || isMaskedBlock(target)
    if (target.type === 'text' || target.type === 'verbatim') {
      if (typeof target.value === 'string') leaves.push({ value: target.value, guarded: hidden })
      return
    }
    if ('content' in target) walk(target.content, hidden)
  }
  walk(node, false)
  return leaves
}

/*
=begin pod :kind<export>

=head2 getMaskedTextContent

The text C<getTextContentFromNode> gives, with each hidden piece under the mask.
Whitespace keeps its place. For a node with nothing hidden in it the two return
the same string. Meant for text a host writes out itself, past the renderer: a
page title, an index entry, a site name.

=end pod
*/
export const getMaskedTextContent = (node: unknown): string =>
  guardedTextLeaves(node)
    .map(leaf => (leaf.guarded ? maskText(leaf.value) : leaf.value))
    .join('')

/*
=begin pod :kind<export>

=head2 renderCodeText

The text a code such as C<S<>> shows, ready for an output to write: its pieces in
order, each hidden piece under the mask when the context covers it, and nothing of
a C<Z<>> comment. The cover is inherited from the code itself and from every
C<G<>> code or hidden mark above a piece, so a piece the mark did not reach is
still hidden. A forced mask covers everything and draft covers nothing, as
C<isCovered> decides. The text is not escaped.

=end pod
*/
export const renderCodeText = (node: unknown, ctx?: { maskMode?: boolean; renderMode?: string }): string => {
  const pieces: string[] = []
  const walk = (value: unknown, hidden: boolean): void => {
    if (Array.isArray(value)) {
      value.forEach(item => walk(item, hidden))
      return
    }
    if (typeof value === 'string') {
      pieces.push(hidden ? maskText(value) : value)
      return
    }
    if (!value || typeof value !== 'object') return
    const target = value as { type?: string; name?: string; value?: unknown; content?: unknown; guarded?: boolean }
    if (target.type === 'fcode' && target.name === 'Z') return
    const covered =
      ctx?.maskMode === true ||
      (ctx?.renderMode !== 'draft' &&
        (hidden || target.guarded === true || isGuardCode(target) || isMaskedBlock(target)))
    if (target.type === 'text' || target.type === 'verbatim') {
      if (typeof target.value === 'string') pieces.push(covered ? maskText(target.value) : target.value)
      return
    }
    if ('content' in target) walk(target.content, covered)
  }
  walk(node, false)
  return pieces.join('')
}
