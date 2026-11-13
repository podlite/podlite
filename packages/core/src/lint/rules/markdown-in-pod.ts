import { isVerbatimBlock } from '@podlite/schema'
import type { Violation, SourceRule } from '../types'
import { lineStarts, placeAtLine } from '../line-starts'

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

// A lone # as the first word of an item, a heading or a definition numbers it, and
// with :!numbered it is a literal #; either way it is not a Markdown heading.
const NUMBERABLE = /^(item\d*|head\d*|defn)$/
const LONE_HASH = /^\s*#(\s|$)/
// directives that set things up and add no text of their own
const SETUP = /^\s*=(config|alias|set)\b/

// Talk about Markdown is legal: a line whose construct sits inside an inline
// code span is showing the markup, not using it.
const insideCode = (line: string): boolean => /C<[^>]*>/.test(line) || /`[^`]+`/.test(line)

export function scanMarkdownInPod(content: string): Violation[] {
  const lines = content.split(/\r?\n/)
  const starts = lineStarts(content)
  const open: string[] = []
  const violations: Violation[] = []
  let abbreviatedTable = false
  // the first word of a numberable block is still to come: in a delimited block blank
  // lines and setup directives come before it, in the other forms they end the block
  let awaiting: 'delimited' | 'paragraph' | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const end = line.match(/^\s*=end\s+([\w-]+)/)
    if (end) {
      awaiting = null
      open.pop()
      continue
    }
    const begin = line.match(/^\s*=begin\s+([\w-]+)/)
    if (begin) {
      awaiting = NUMBERABLE.test(begin[1]) ? 'delimited' : null
      open.push(begin[1])
      abbreviatedTable = false
      continue
    }
    // a continuation line belongs to the directive above it
    if (awaiting && /^\s*=(\s|$)/.test(line)) continue
    if (awaiting === 'delimited' && SETUP.test(line)) continue
    if (/^\s*=/.test(line)) {
      const marker = line.match(/^\s*=(?:for\s+)?([\w-]+)(.*)$/)
      const named = marker ? marker[1] : ''
      const shortForm = !/^\s*=for\s/.test(line)
      awaiting = marker && NUMBERABLE.test(named) && (!shortForm || marker[2].trim() === '') ? 'paragraph' : null
    } else if (line.trim() === '') {
      if (awaiting === 'paragraph') awaiting = null
    }
    const first = awaiting !== null && line.trim() !== '' && !/^\s*=/.test(line)
    if (first) awaiting = null
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
      if (first && foreign === FOREIGN[0] && LONE_HASH.test(line)) continue
      violations.push({
        rule: MARKDOWN_IN_POD_RULE_ID,
        severity: 'warning',
        message: foreign.says,
        location: placeAtLine(starts, i + 1),
      })
      break
    }
  }

  return violations
}
