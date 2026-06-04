import type { Violation, SourceRule } from '../types'

const lintGrammar = require('./lint.js')

export const ATTR_NESTED_ANGLE_RULE_ID = 'attr-nested-angle'

export const attrNestedAngleRule: SourceRule = {
  id: ATTR_NESTED_ANGLE_RULE_ID,
  severity: 'error',
}

export const SOURCE_RULES: SourceRule[] = [attrNestedAngleRule]

type GrammarOptions = { diagnostics: Violation[] }

export function scanSourceRules(content: string): Violation[] {
  const opts: GrammarOptions = { diagnostics: [] }
  try {
    lintGrammar.parse(content, opts)
  } catch {
    // Grammar has a `.` fallback for any character — should not fail; swallow defensively.
  }
  return opts.diagnostics
}
