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
The header of a block and its configuration lines keep their warnings (the body is
counted back from the end of the block by the lines of its text), a table is left
to the scanners, and an open code in a block whose C<:allow> lets
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

// the text a node holds, with the codes in it read as their text
const textOf = (node: unknown): string => {
  if (typeof node === 'string') return node
  const value: unknown = Reflect.get(Object(node), 'value')
  const content: unknown = Reflect.get(Object(node), 'content')
  return (typeof value === 'string' ? value : '') + (Array.isArray(content) ? content.map(textOf).join('') : '')
}

// The body of a verbatim block is the last lines of the block, as many as its text has, before
// an =end of a delimited one; the header and its continuations come before. The parser keeps the
// body, not its place, so the place is counted back from the end, and the header is never read.
const bodyLines = (node: { type?: unknown; text?: unknown; content?: unknown }, last: number): [number, number] => {
  if (node.type === 'code') return [-Infinity, last]
  const body = textOf({ content: node.content })
  const count = body === '' ? 0 : body.split('\n').length - (body.endsWith('\n') ? 1 : 0)
  const end = typeof node.text === 'string' && /^\s*=begin\b/.test(node.text) ? last - 1 : last
  return [end - count + 1, end]
}
export function dropSourceWarningsInCode(violations: Violation[], ast: PodliteDocument, source: string): Violation[] {
  if (!violations.some(readsSource)) return violations
  if (/\r(?!\n)/.test(source)) return violations
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
    const [from, to] = bodyLines(node, last)
    for (let line = Math.max(from, place.start.line); line <= to; line++) {
      markdown.add(line)
      if (!allowed) unclosed.add(line)
    }
  }
  const quietFor = (v: Violation) => (v.rule === MARKDOWN_IN_POD_RULE_ID ? markdown : unclosed)
  return violations.filter(v => !(readsSource(v) && v.location && quietFor(v).has(v.location.start.line)))
}
