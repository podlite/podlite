import makeAttrs from './helpers/config'
import { getExplicitNodeId } from './ast-helpers'

/*
=begin pod :kind<module>

=head2 How a test is shown

A C<=test> is shown where it stands, under the block it checks: a line naming the
test, and below it the fixture as source, each assertion and each resource. Every
renderer answers the same two questions about it, and answers them here so that a
page and an export never disagree.

=end pod
*/

/*
=begin pod :kind<export>

=head2 testCaption

The words shown on the line of a test. The caption the author wrote for the test
comes first; without one, its C<:id>; without either, the word C<test>, so the line
is never empty. The caption of an assertion is not borrowed: it says what one check
is for, not the whole test.

=end pod
*/
export const testCaption = (node: any, ctx: any): string => {
  const conf = makeAttrs(node, ctx || {})
  if (conf.exists('caption')) {
    const caption = String(conf.getFirstValue('caption') ?? '').trim()
    if (caption) return caption
  }
  const id = getExplicitNodeId(node, ctx || {})
  return id ? String(id) : 'test'
}

/*
=begin pod :kind<export>

=head2 testFoldedByAuthor

Whether the author asked for the test to start folded: C<true> for C<:folded> or
C<:folded(1)>, C<false> for C<:!folded> or C<:folded(0)>, C<undefined> when the
author said nothing and the renderer decides. A C<=config test> line counts as
the author's word.

=end pod
*/
export const testFoldedByAuthor = (node: any, ctx: any): boolean | undefined => {
  const conf = makeAttrs(node, ctx || {})
  if (!conf.exists('folded')) return undefined
  const value = conf.getFirstValue('folded')
  return !(value === false || value === 0 || value === '0')
}

// A fence has to be longer than any run of backticks inside what it encloses.
export const longestBacktickRun = (text: string): number =>
  Math.max(0, ...(text.match(/`+/g) || []).map(run => run.length))
