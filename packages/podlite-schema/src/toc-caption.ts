import { isCovered } from './guard'
import { maskText } from './helpers/handlers'

/*
=begin pod :kind<export>

=head2 tocTitleText

The caption of a table of contents that has only its C<title> string and no parsed
C<caption>: a tree built before the caption was parsed. The string is hidden as a
whole when the table is hidden, and also outside draft mode when it contains a
C<G> code, since a string cannot hide one word of itself. Returns C<undefined>
when the table has no caption.

=end pod
*/
export const tocTitleText = (
  node: { title?: unknown; guarded?: boolean },
  ctx?: { maskMode?: boolean; renderMode?: string },
): string | undefined => {
  if (node.title === undefined || node.title === null || String(node.title) === '') return undefined
  const text = String(node.title)
  const holdsGuard = /G[<«]/.test(text) && ctx?.renderMode !== 'draft'
  return isCovered(node, ctx) || holdsGuard ? maskText(text) : text
}
