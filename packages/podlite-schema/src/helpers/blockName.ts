/*
=begin pod :kind<module>

=head2 blockName

Which node of a tree is a block, and of what name: one rule for the selection,
the settings of C<=config> and the assignments of C<=set>.

=end pod
*/
import { isSemanticBlock } from './makeTransformer'

// Within these blocks text written without a marker is a paragraph and lines
// set in from the margin are a code block. Anywhere else a para node is the
// text of the block around it: of an explicit =para, of a heading.
const IMPLICIT_HOLDERS = new Set(['root', 'pod', 'item', 'defn', 'nested', 'cell'])

export type Walked = { type?: string; name?: string; content?: unknown }

// A node outside any block is in the document, and a document is a pod.
const holdsImplicit = (holder: Walked | undefined): boolean =>
  holder === undefined ||
  (holder.type === 'block' &&
    (IMPLICIT_HOLDERS.has(holder.name ?? '') || (Boolean(holder.name) && isSemanticBlock(holder))))

// Wrappers the tree adds around written blocks: the document, the blocks of a
// Markdown section, a heading folded together with its text. No author writes
// them, so no pattern finds them; the walk goes through.
const WRAPPERS = new Set(['root', '_folded_section'])

export const isWrapper = (node: Walked): boolean => node.type === 'block' && WRAPPERS.has(node.name ?? '')

/*
=begin pod :kind<export>

=head2 blockNameOf

The name of the block a node stands for: the name of a block written with a
directive, C<para> or C<code> for one written without, none for anything else.
C<holder> is the block whose content holds the node; none means the document.
A paragraph node is a block only where text without a marker is a paragraph:
inside an explicit C<=para> or a heading it is that block's own text. The term
of a C<=defn> is its heading, not a paragraph.

=end pod
*/
export const blockNameOf = (node: Walked, holder: Walked | undefined): string | undefined => {
  if (node.type === 'block') return isWrapper(node) ? undefined : node.name
  if (node.type === 'code') return 'code'
  if (node.type === 'para' && node.name !== 'term' && holdsImplicit(holder)) return 'para'
  return undefined
}

/*
=begin pod :kind<export>

=head2 holderInside

The holder for the content of C<node>, given the holder of C<node> itself. A
folded section is a wrapper the tree adds around a heading and its text; the
text stands where it was written.

=end pod
*/
export const holderInside = (node: Walked, holder: Walked | undefined): Walked | undefined =>
  node.type === 'block' && node.name === '_folded_section' ? holder : node
