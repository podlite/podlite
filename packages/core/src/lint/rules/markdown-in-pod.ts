import { isVerbatimBlock } from '@podlite/schema'
import type { Violation, SourceRule } from '../types'

export const MARKDOWN_IN_POD_RULE_ID = 'markdown-in-pod'

export const markdownInPodRule: SourceRule = {
  id: MARKDOWN_IN_POD_RULE_ID,
  severity: 'warning',
}

// Inside a pod block only Podlite is read. Markup of another language arrives
// as ordinary text and leaves the document with escaped characters where the
// author meant a heading, a table or emphasis. The parser is right and has
// nothing to say, so the check says it instead.
type Foreign = { test: RegExp; says: string }

const FOREIGN: Foreign[] = [
  { test: /^\s*#{1,6}\s+\S/, says: 'a heading written with hashes is text here; write =head1 and its levels' },
  {
    test: /^\s*\|?[\s:|-]*-[\s:|-]*\|[\s:|-]*$/,
    says: 'a row of bars and dashes is text here; a table is written as =begin table with its own separator',
  },
  { test: /\*\*[^*\s](?:[^*]*[^*\s])?\*\*/, says: 'a pair of asterisks is text here; bold is written as B<>' },
]

// Talk about Markdown is legal: a line whose construct sits inside an inline
// code span is showing the markup, not using it.
const insideCode = (line: string): boolean => /C<[^>]*>/.test(line) || /`[^`]+`/.test(line)

export function scanMarkdownInPod(content: string): Violation[] {
  const lines = content.split(/\r?\n/)
  const open: string[] = []
  const violations: Violation[] = []
  let abbreviatedTable = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const end = line.match(/^\s*=end\s+([\w-]+)/)
    if (end) {
      open.pop()
      continue
    }
    const begin = line.match(/^\s*=begin\s+([\w-]+)/)
    if (begin) {
      open.push(begin[1])
      abbreviatedTable = false
      continue
    }
    // a dash separator belongs to a table written the short way too, and that
    // block runs to the first blank line
    if (/^\s*=(?:for\s+)?table\b/.test(line)) {
      abbreviatedTable = true
      continue
    }
    if (abbreviatedTable && line.trim() === '') abbreviatedTable = false
    if (/^\s*=/.test(line)) abbreviatedTable = false

    if (open.some(isVerbatimBlock) || open.includes('data') || abbreviatedTable) continue
    if (insideCode(line)) continue

    for (const foreign of FOREIGN) {
      if (!foreign.test.test(line)) continue
      violations.push({
        rule: MARKDOWN_IN_POD_RULE_ID,
        severity: 'warning',
        message: foreign.says,
        location: {
          start: { line: i + 1, column: 1, offset: 0 },
          end: { line: i + 1, column: 1, offset: 0 },
        },
      })
      break
    }
  }

  return violations
}
