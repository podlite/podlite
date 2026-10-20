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

// a heading, a directive, a comment or data says nothing a test could check, and a
// directive wrapped into a group would lose the reach it has over what follows
const NOT_A_TEST_OWNER = new Set([
  'head',
  'comment',
  'data',
  'test',
  'fixture',
  'assert',
  'resource',
  'include',
  'toc',
  'pod',
])

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

/*
=begin pod :kind<export>

=head2 canOwnTest

Whether a node can be the block a C<=test> right after it belongs to. A test
belongs to the nearest preceding sibling that is not itself a test; when that
sibling cannot own it, the page draws the test with no rule and the linter warns.
A paragraph, a list and code can; so can any block but a heading, a directive, a
comment, data, a part of a test, a table of contents and the blocks the tree adds,
whose names begin with C<_>.

=end pod
*/
export const canOwnTest = (node: unknown): boolean => {
  if (!isRecord(node)) return false
  if (node.type === 'para' || node.type === 'list' || node.type === 'code') return true
  if (node.type !== 'block' || typeof node.name !== 'string') return false
  return !node.name.startsWith('_') && !NOT_A_TEST_OWNER.has(node.name)
}

// source, data and the parts of a test hold no tests of their own
const HOLDS_NO_TESTS = new Set([
  'test',
  'fixture',
  'assert',
  'resource',
  'code',
  'comment',
  'data',
  'markdown',
  'input',
  'output',
  'formula',
])

/*
=begin pod :kind<export>

=head2 mayHoldTests

Whether a test can stand among the children of a node, so that a pass over the
tests of a document goes into it: no for a test itself and its parts, and for
code, comments, data, Markdown, input, output and formulas.

=end pod
*/
export const mayHoldTests = (node: unknown): boolean => !isRecord(node) || !HOLDS_NO_TESTS.has(String(node.name))
