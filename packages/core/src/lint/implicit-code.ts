import { getFromTree, PodliteDocument } from '@podlite/schema'
import type { Violation } from './types'
import { MARKDOWN_IN_POD_RULE_ID } from './rules/markdown-in-pod'

type Place = { start: { line: number; column: number }; end: { line: number; column: number } }

/*
=begin pod :kind<export>

=head2 dropMarkdownInImplicitCode

Takes out the C<markdown-in-pod> warnings that stand on lines the parser read as
implicit code: indented text there is shown as written, so Markdown in it is an
example rather than a slip. Every other warning is kept, in its order. The tree is
the one the caller has already parsed; it is walked once. A document with a lone
carriage return is left as it is: the parser ends a line there without counting it,
so its line numbers and the scanner's do not meet.

=end pod
*/
export function dropMarkdownInImplicitCode(violations: Violation[], ast: PodliteDocument, source: string): Violation[] {
  if (!violations.some(v => v.rule === MARKDOWN_IN_POD_RULE_ID)) return violations
  if (/\r(?!\n)/.test(source)) return violations
  const code = new Set<number>()
  for (const node of getFromTree(ast, () => true)) {
    if (typeof node !== 'object' || node === null || node.type !== 'code') continue
    const place: Place | undefined = Reflect.get(node, 'location')
    if (!place) continue
    // a node that ends at the first column of a line does not hold that line
    const last = place.end.column > 1 ? place.end.line : place.end.line - 1
    for (let line = place.start.line; line <= last; line++) code.add(line)
  }
  return violations.filter(v => !(v.rule === MARKDOWN_IN_POD_RULE_ID && v.location && code.has(v.location.start.line)))
}
