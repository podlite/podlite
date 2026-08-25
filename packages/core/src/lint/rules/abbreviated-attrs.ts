import { isVerbatimBlock } from '@podlite/schema'
import type { Violation, SourceRule } from '../types'

export const ABBREVIATED_ATTRS_RULE_ID = 'abbreviated-attrs'

export const abbreviatedAttrsRule: SourceRule = {
  id: ABBREVIATED_ATTRS_RULE_ID,
  severity: 'warning',
}

// The specification is plain about it: the rest of an abbreviated block's line
// is block data, not configuration. What the author wrote as an attribute
// arrives as text, the markup stays legal, and nothing says the mechanism did
// not run.
const ABBREVIATED = /^\s*=([A-Za-z][\w-]*)[ \t]+(\S.*)$/
const DELIMITED = /^\s*=(?:begin|end|for)[ \t]+([\w-]+)/

// Only a line made of attributes and nothing else is reported. A line where
// attributes stand next to real text is the author writing prose that happens
// to hold a colon, and calling that a fault would bury the rule in noise.
const ONLY_ATTRIBUTES = /^(:[A-Za-z][\w-]*(<[^>]*>|\([^)]*\)|\{[^}]*\}|\[[^\]]*\])?[ \t]*)+$/

// An attribute written with nothing inside documents the attribute itself,
// which is how the registries and the specifications spell one out.
const EMPTY_VALUE = /^:[A-Za-z][\w-]*<>$/

const allEmpty = (rest: string): boolean =>
  rest
    .trim()
    .split(/[ \t]+/)
    .every(part => EMPTY_VALUE.test(part))

export function scanAbbreviatedAttrs(content: string): Violation[] {
  const lines = content.split(/\r?\n/)
  const open: string[] = []
  const violations: Violation[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const delimited = line.match(DELIMITED)
    if (delimited) {
      if (/^\s*=end\b/.test(line)) open.pop()
      else if (/^\s*=begin\b/.test(line)) open.push(delimited[1])
      continue
    }

    if (open.some(isVerbatimBlock)) continue

    const abbreviated = line.match(ABBREVIATED)
    if (!abbreviated) continue

    const [, name, rest] = abbreviated
    if (isVerbatimBlock(name)) continue
    if (!ONLY_ATTRIBUTES.test(rest.trim())) continue
    if (allEmpty(rest)) continue

    // content has to follow, otherwise the line is the whole block and the
    // author wrote no data at all — a different mistake, if it is one
    const next = lines[i + 1]
    if (next === undefined || next.trim() === '' || /^\s*=/.test(next)) continue

    violations.push({
      rule: ABBREVIATED_ATTRS_RULE_ID,
      severity: 'warning',
      message: `=${name} takes the rest of its line as data, so ${rest.trim()} arrives as text; write =for ${name} to pass configuration`,
      location: {
        start: { line: i + 1, column: 1, offset: 0 },
        end: { line: i + 1, column: 1, offset: 0 },
      },
    })
  }

  return violations
}
