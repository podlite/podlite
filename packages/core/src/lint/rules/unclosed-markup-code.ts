import { isVerbatimBlock } from '@podlite/schema'
import type { Violation, SourceRule } from '../types'

export const UNCLOSED_MARKUP_CODE_RULE_ID = 'unclosed-markup-code'

export const unclosedMarkupCodeRule: SourceRule = {
  id: UNCLOSED_MARKUP_CODE_RULE_ID,
  severity: 'warning',
}

// The specification leaves the parser no choice: a markup code that ends at the
// end of its block rather than at its own delimiter is to be reported. The
// parser instead drops such a code and the text goes out carrying the opening
// letter, so the whole line reads as written rather than as marked up.
//
// Closure is counted the way the specification defines it: a code opened with N
// angle brackets is closed by N of them together, and one opened with a
// guillemet by the closing guillemet. Counting rather than asking the parser
// keeps the doubled forms out of the report — C<< text >> is closed, and the
// parser drops it for reasons of its own when it sits inside another code.
//
// One case stays out of reach: an outer code opened with a single bracket whose
// inner code closes with its own. The count sees that bracket and calls the
// outer one closed. Asking the parser instead catches it, but then every single
// code written inside a doubled one reads as unclosed, and correct markup gets
// reported — the worse of the two.
const OPENER = /(^|[^A-Za-z])([A-Z])(<+|«)/g

const unclosed = (text: string): Array<{ name: string; at: number }> => {
  const missing: Array<{ name: string; at: number }> = []
  let match: RegExpExecArray | null
  OPENER.lastIndex = 0
  while ((match = OPENER.exec(text)) !== null) {
    const [whole, before, name, open] = match
    const rest = text.slice(match.index + whole.length)
    const closed = open === '«' ? rest.includes('»') : rest.includes('>'.repeat(open.length))
    if (!closed) {
      missing.push({ name, at: match.index + before.length })
      continue
    }
    // an empty code names the code rather than marks anything up
    if (open === '«' ? rest.startsWith('»') : rest.startsWith('>'.repeat(open.length))) continue
  }
  return missing
}

type Chunk = { text: string; line: number }

export function scanUnclosedMarkupCodes(content: string): Violation[] {
  const lines = content.split(/\r?\n/)
  const open: string[] = []
  const violations: Violation[] = []
  let chunk: Chunk | null = null

  const close = () => {
    if (!chunk) return
    const at = chunk
    for (const found of unclosed(at.text)) {
      const name = found.name
      const line = at.line + at.text.slice(0, found.at).split('\n').length - 1
      violations.push({
        rule: UNCLOSED_MARKUP_CODE_RULE_ID,
        severity: 'warning',
        message: `${name}<> is closed by the end of the block, not by its own bracket; the text goes out as written`,
        location: {
          start: { line, column: 1, offset: 0 },
          end: { line, column: 1, offset: 0 },
        },
      })
    }
    chunk = null
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (/^\s*=end\s+[\w-]+/.test(line)) {
      close()
      open.pop()
      continue
    }
    const begin = line.match(/^\s*=begin\s+([\w-]+)/)
    if (begin) {
      close()
      open.push(begin[1])
      continue
    }
    if (open.some(isVerbatimBlock)) continue

    // a directive starts a chunk of its own; a blank line ends the one running
    if (/^\s*=/.test(line)) {
      close()
      chunk = { text: line, line: i + 1 }
      continue
    }
    if (line.trim() === '') {
      close()
      continue
    }
    if (chunk) chunk.text += '\n' + line
    else chunk = { text: line, line: i + 1 }
  }
  close()

  return violations
}
