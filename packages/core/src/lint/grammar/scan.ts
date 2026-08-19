import type { Violation, SourceRule } from '../types'
import { VERBATIM_BLOCKS, type Location } from '@podlite/schema'
import { scanTableColumns, tableColumnWidthRule } from '../rules/table-column-width'

const lintGrammar = require('./lint.js')

export const ATTR_NESTED_ANGLE_RULE_ID = 'attr-nested-angle'
export const DELIMITED_BLOCK_BALANCE_RULE_ID = 'delimited-block-balance'
export const ATTR_CONTINUATION_DROPPED_RULE_ID = 'attr-continuation-dropped'

export const attrNestedAngleRule: SourceRule = {
  id: ATTR_NESTED_ANGLE_RULE_ID,
  severity: 'error',
}

export const delimitedBlockBalanceRule: SourceRule = {
  id: DELIMITED_BLOCK_BALANCE_RULE_ID,
  severity: 'error',
}

export const attrContinuationDroppedRule: SourceRule = {
  id: ATTR_CONTINUATION_DROPPED_RULE_ID,
  severity: 'warning',
}

export const SOURCE_RULES: SourceRule[] = [
  attrNestedAngleRule,
  delimitedBlockBalanceRule,
  attrContinuationDroppedRule,
  tableColumnWidthRule,
]

type BlockMarker = { name: string; location: Location }
type GrammarOptions = {
  diagnostics: Violation[]
  _blockStack: BlockMarker[]
  _inDirective: boolean
  verbatimBlocks: string[]
}

export function scanSourceRules(content: string): Violation[] {
  const opts: GrammarOptions = {
    diagnostics: [],
    _blockStack: [],
    _inDirective: false,
    verbatimBlocks: [...VERBATIM_BLOCKS],
  }
  try {
    lintGrammar.parse(content, opts)
  } catch {
    // Grammar has a `.` fallback for any character — should not fail; swallow defensively.
  }
  for (const item of opts._blockStack) {
    opts.diagnostics.push({
      rule: DELIMITED_BLOCK_BALANCE_RULE_ID,
      severity: 'error',
      message: `=begin ${item.name} is not closed before end of file`,
      location: item.location,
    })
  }
  opts.diagnostics.push(...scanTableColumns(content))
  return opts.diagnostics
}
