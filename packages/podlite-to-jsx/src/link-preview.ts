import type { ReactNode } from 'react'
import { getExplicitNodeId, getTextContentFromNode, indexAnchors } from '@podlite/schema'

/*
=begin pod :kind<module> :id<@podlite/to-jsx/link-preview>

=head2 What a link preview shows

A link that points inside the same document can show what stands at its target
without taking the reader there. This module answers one question for the
renderer: given the target of such a link, what text sits under it.

The answer is prepared once for the whole document, before any link is drawn.
Two kinds of target reach it. One is a heading, found by the name it carries.
The other is a node the author named with C<:id>. A name written by the author
wins over one derived from a heading: the author said it on purpose.

=head2 What counts as the text of a target

A heading in Podlite owns nothing below it. The nodes that follow are its
siblings, not its children. So the text is looked for by walking forward from
the target and taking the first node that renders anything at all. Blank lines
and comments are stepped over; a heading of the same or higher level ends the
search, because past it the reader is in another section.

The result is cut to a length that fits a popup. What is cut is text, not
markup: nothing here produces markup.

=end pod
*/

/*
=begin pod :kind<export> :id<@podlite/to-jsx/link-preview#LinkPreviewTarget>

=head2 LinkPreviewTarget

What was found at the target of a link. C<text> is the visible text prepared for
showing; C<kind> says which of the two searches found it: a heading, or a name
the author wrote as C<:id>.

=end pod
*/
export type LinkPreviewTarget = { text: string; kind: 'heading' | 'explicit-id' }

/*
=begin pod :kind<export> :id<@podlite/to-jsx/link-preview#LinkPreviewResolver>

=head2 LinkPreviewResolver

Supplied by the code that uses the renderer, to decide what a hovered link shows
and how it looks. It receives the target as the author wrote it and whatever was
found there. It returns what to show, or C<null> to show nothing.

Without a resolver a link renders as it always has. The renderer has no preview
of its own to fall back to, and looks nothing up.

The renderer imposes no markup and no styling on what comes back.

=end pod
*/
export type LinkPreviewResolver = (
  target: string,
  resolved: LinkPreviewTarget | undefined,
) => ReactNode | null

// Longer than a popup can show without becoming a page of its own. Chosen by
// measuring the first visible text under headings across the knowledge base.
const CUT_AT = 200

const RENDERS_NOTHING = new Set(['blankline', 'comment'])

const rendersNothing = (node: any): boolean =>
  !node || typeof node !== 'object' || RENDERS_NOTHING.has(node.type) || RENDERS_NOTHING.has(node.name)

const headingLevel = (node: any): number | undefined =>
  node && node.name === 'head' ? Number(node.level) || 1 : undefined

const cut = (text: string): string => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length <= CUT_AT ? flat : `${flat.slice(0, CUT_AT).trimEnd()}…`
}

// The text a target stands for: its own, when the author named the node; the
// first thing that renders, when the target is a heading.
const textAfter = (siblings: any[], at: number, stopAtOrAbove?: number): string => {
  for (let i = at + 1; i < siblings.length; i++) {
    const node = siblings[i]
    const level = headingLevel(node)
    if (level !== undefined && stopAtOrAbove !== undefined && level <= stopAtOrAbove) return ''
    if (rendersNothing(node)) continue
    const text = cut(getTextContentFromNode(node))
    if (text) return text
  }
  return ''
}

// Walked once per document, before the first link is drawn.
export const buildLinkPreviewIndex = (tree: unknown): Map<string, LinkPreviewTarget> => {
  const found = new Map<string, LinkPreviewTarget>()
  const anchorOf = indexAnchors(tree).byNode

  const visit = (siblings: any[]): void => {
    siblings.forEach((node, at) => {
      if (!node || typeof node !== 'object') return
      const level = headingLevel(node)
      // A heading stands for what follows it, even when the author also named it:
      // a reader following such a link wants the section, not the title twice.
      const entry: LinkPreviewTarget =
        level === undefined
          ? { text: cut(getTextContentFromNode(node)), kind: 'explicit-id' }
          : { text: textAfter(siblings, at, level), kind: 'heading' }
      const explicit = getExplicitNodeId(node, {})
      if (explicit) found.set(explicit, entry)
      const anchor = anchorOf.get(node)
      if (anchor && !found.has(anchor)) found.set(anchor, entry)
      if (Array.isArray(node.content)) visit(node.content)
    })
  }
  visit(Array.isArray(tree) ? tree : [tree])
  return found
}
