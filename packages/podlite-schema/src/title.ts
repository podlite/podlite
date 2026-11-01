/*
=begin pod :kind<export>

=head2 titleParts

Splits the content of a C<=TITLE> block into what a writer puts in the title line
and what follows it, in the order of the source. A paragraph gives a C<part> with
its inline nodes and the paragraphs that hold them (C<owners>, for their masks);
the paragraphs of an explicit C<=para> are taken one by one. Every other child,
a directive included, is a C<rest> entry at its place, so a writer that goes
through the entries once lets a directive act from where it stands. The nodes are
the nodes of the tree, not copies: an index that knows a note by its node still
finds it.

=end pod
*/
import { Node } from './types'

export type TitleEntry = { kind: 'part'; content: Node[]; owners: Node[] } | { kind: 'rest'; node: Node }

export const titleParts = (node: { content?: unknown }): TitleEntry[] => {
  const entries: TitleEntry[] = []
  const walk = (children: unknown, owners: Node[]) => {
    const list = Array.isArray(children) ? children : children ? [children] : []
    list.forEach((child: any) => {
      if (child && typeof child === 'object' && child.type === 'para') {
        entries.push({ kind: 'part', content: child.content || [], owners: [...owners, child] })
      } else if (child && typeof child === 'object' && child.type === 'block' && child.name === 'para') {
        walk(child.content, [...owners, child])
      } else {
        entries.push({ kind: 'rest', node: child })
      }
    })
  }
  walk(node.content, [])
  return entries
}

// a TITLE written in the singular or the plural, as the specification lets a semantic block be
export const isTitleBlock = (node: any): boolean =>
  Boolean(node) && node.type === 'block' && (node.name === 'TITLE' || node.name === 'TITLES')

// Whether a title has anything to show, read from the tree: a character outside Z<>,
// a picture, the marker of a note, or E<> that gives a visible character. The outputs
// decide by what they write; this answers before anything is written, for an index
// that must not lead to a heading no output writes. An alias is taken as showing
// something, since what it holds is known only when it is expanded.
const showsSomething = (nodes: unknown): boolean =>
  (Array.isArray(nodes) ? nodes : nodes ? [nodes] : []).some((node: any) => {
    if (typeof node === 'string') return /\S/.test(node)
    if (!node || typeof node !== 'object') return false
    if (node.type === 'text') return /\S/.test(node.value || '')
    if (node.type === 'image') return true
    if (node.type === 'fcode') {
      if (node.name === 'Z') return false
      if (node.name === 'A' || node.name === 'P') return true
      // a note shows its marker when it holds anything at all
      if (node.name === 'N') return Array.isArray(node.content) ? node.content.length > 0 : Boolean(node.content)
      if (node.name === 'E')
        return (node.content || []).some((part: any) =>
          part?.type === 'number' ? /\S/.test(String.fromCodePoint(part.value)) : true,
        )
    }
    return showsSomething(node.content)
  })

export const titleShowsSomething = (node: { content?: unknown }): boolean =>
  titleParts(node).some(entry => entry.kind === 'part' && showsSomething(entry.content))
