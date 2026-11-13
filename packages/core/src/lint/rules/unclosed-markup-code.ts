import { isVerbatimBlock } from '@podlite/schema'
import type { Violation, SourceRule } from '../types'
import { lineStarts, placeAtLine } from '../line-starts'

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

// For each length of a run of closing brackets, the last place a closer of that
// length can start: a code opened with N brackets is closed if one starts after it.
// Built once per fragment, so a long paragraph is not searched again for every code.
const lastCloserStarts = (text: string): number[] => {
  const bestEnd: number[] = [-1, -1]
  let at = 0
  while (at < text.length) {
    if (text.charCodeAt(at) !== 62) {
      at++
      continue
    }
    const start = at
    while (at < text.length && text.charCodeAt(at) === 62) at++
    const length = at - start
    while (bestEnd.length < length + 2) bestEnd.push(-1)
    bestEnd[length] = Math.max(bestEnd[length], at)
  }
  // a longer run holds every shorter closer, ending where it ends
  for (let length = bestEnd.length - 2; length >= 1; length--) {
    bestEnd[length] = Math.max(bestEnd[length], bestEnd[length + 1])
  }
  return bestEnd.map((end, length) => (end === -1 ? -1 : end - length))
}

const unclosed = (text: string): Array<{ name: string; at: number }> => {
  const missing: Array<{ name: string; at: number }> = []
  const closerStarts = lastCloserStarts(text)
  const lastGuillemet = text.lastIndexOf('»')
  let match: RegExpExecArray | null
  OPENER.lastIndex = 0
  while ((match = OPENER.exec(text)) !== null) {
    const [whole, before, name, open] = match
    const from = match.index + whole.length
    const closer = open === '«' ? lastGuillemet : closerStarts[open.length] ?? -1
    if (closer < from) {
      missing.push({ name, at: match.index + before.length })
    }
  }
  return missing
}

type Chunk = { text: string; line: number }

export function scanUnclosedMarkupCodes(content: string): Violation[] {
  const lines = content.split(/\r?\n/)
  const starts = lineStarts(content)
  const open: string[] = []
  let verbatimOpen = 0
  const violations: Violation[] = []
  let chunk: Chunk | null = null
  let inAbbreviatedVerbatim = false

  const close = () => {
    if (!chunk) return
    const at = chunk
    // the codes come in order, so the line is counted on from the one before
    let line = at.line
    let counted = 0
    for (const found of unclosed(at.text)) {
      const name = found.name
      for (; counted < found.at; counted++) if (at.text.charCodeAt(counted) === 10) line++
      violations.push({
        rule: UNCLOSED_MARKUP_CODE_RULE_ID,
        severity: 'warning',
        message: `${name}<> is closed by the end of the block, not by its own bracket; the text goes out as written`,
        location: placeAtLine(starts, line),
      })
    }
    chunk = null
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (/^\s*=end\s+[\w-]+/.test(line)) {
      close()
      inAbbreviatedVerbatim = false
      const closed = open.pop()
      if (closed !== undefined && isVerbatimBlock(closed)) verbatimOpen--
      continue
    }
    const begin = line.match(/^\s*=begin\s+([\w-]+)/)
    if (begin) {
      close()
      inAbbreviatedVerbatim = false
      open.push(begin[1])
      if (isVerbatimBlock(begin[1])) verbatimOpen++
      continue
    }
    if (verbatimOpen > 0) continue

    // a directive starts a chunk of its own; a blank line ends the one running
    if (/^\s*=/.test(line)) {
      close()
      const named = line.match(/^\s*=(?:for\s+)?([\w-]+)/)
      // the short forms carry verbatim text just as the paired ones do
      inAbbreviatedVerbatim = Boolean(named && isVerbatimBlock(named[1]))
      if (!inAbbreviatedVerbatim) chunk = { text: line, line: i + 1 }
      continue
    }
    if (line.trim() === '') {
      close()
      inAbbreviatedVerbatim = false
      continue
    }
    if (inAbbreviatedVerbatim) continue
    if (chunk) chunk.text += '\n' + line
    else chunk = { text: line, line: i + 1 }
  }
  close()

  return violations
}
