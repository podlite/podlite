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
