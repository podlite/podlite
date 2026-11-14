import { getFromTree, isVerbatimBlock, PodliteDocument } from '@podlite/schema'
import type { Violation } from './types'
import { MARKDOWN_IN_POD_RULE_ID } from './rules/markdown-in-pod'
import { UNCLOSED_MARKUP_CODE_RULE_ID } from './rules/unclosed-markup-code'

type Place = { start: { line: number; column: number }; end: { line: number; column: number } }

/*
=begin pod :kind<export>

=head2 dropSourceWarningsInCode

Takes out the C<markdown-in-pod> and C<unclosed-markup-code> warnings that stand on
lines the parser read as code: implicit code, and the body of a verbatim block in
any form (C<=begin code>, C<=for code>, C<=code>, C<=for markdown> and the like).
The configuration lines of a C<=for> or C<=begin> header keep their warnings, a
table is left to the scanners, and an open code in a block whose C<:allow> lets
codes through is still reported.
Those lines are shown as written, with no markup codes read, so Markdown or an open
code in them is an example rather than a slip. The two rules read the source line by
line and cannot tell where the parser puts a block; the tree can. Every other warning
is kept, in its order. The tree is the one the caller has already parsed; it is
walked once. A document with a lone carriage return is left as it is: the parser
ends a line there without counting it, so its line numbers and the scanner's do not
meet.

=end pod
*/
// the rules that read the source and so cannot see that a line is code
const readsSource = (v: Violation): boolean =>
  v.rule === MARKDOWN_IN_POD_RULE_ID || v.rule === UNCLOSED_MARKUP_CODE_RULE_ID

// a table is verbatim to the scanners, but its cells are read as text: the scanners keep deciding there
const TABLES = ['table', 'data-table']
const isCode = (node: { type?: unknown; name?: unknown }): boolean =>
  node.type === 'code' ||
  (node.type === 'block' && typeof node.name === 'string' && isVerbatimBlock(node.name) && !TABLES.includes(node.name))

// codes an :allow lets through are read in code, so an open one there is a real slip
const allowsCodes = (node: unknown): boolean => {
  const config: unknown = Reflect.get(Object(node), 'config')
  return Array.isArray(config) && config.some(c => c && c.name === 'allow')
}

// the =for or =begin line and its = continuations are configuration, not body
const HEADER = /^[ \t\f]*=(for|begin)[ \t]/
const CONTINUATION = /^[ \t\f]*=(\s|$)/
const bodyStart = (lines: string[], node: { type?: unknown }, first: number): number => {
  if (node.type !== 'block' || !HEADER.test(lines[first - 1] ?? '')) return first
  let line = first + 1
  while (CONTINUATION.test(lines[line - 1] ?? '')) line++
  return line
}

export function dropSourceWarningsInCode(violations: Violation[], ast: PodliteDocument, source: string): Violation[] {
  if (!violations.some(readsSource)) return violations
  if (/\r(?!\n)/.test(source)) return violations
  const lines = source.split(/\r?\n/)
  // lines of code for each rule: an open code under :allow is still reported
  const markdown = new Set<number>()
  const unclosed = new Set<number>()
  for (const node of getFromTree(ast, () => true)) {
    if (typeof node !== 'object' || node === null || !isCode(node)) continue
    const place: Place | undefined = Reflect.get(node, 'location')
    if (!place) continue
    // a node that ends at the first column of a line does not hold that line
    const last = place.end.column > 1 ? place.end.line : place.end.line - 1
    const allowed = allowsCodes(node)
    for (let line = bodyStart(lines, node, place.start.line); line <= last; line++) {
      markdown.add(line)
      if (!allowed) unclosed.add(line)
    }
  }
  const quietFor = (v: Violation) => (v.rule === MARKDOWN_IN_POD_RULE_ID ? markdown : unclosed)
  return violations.filter(v => !(readsSource(v) && v.location && quietFor(v).has(v.location.start.line)))
}
