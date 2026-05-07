import type { PodliteDocument } from '@podlite/schema'
import type { Rule, LintContext, Violation } from './types'

export function runRules(ast: PodliteDocument, rules: Rule[], ctx: LintContext): Violation[] {
  return rules.flatMap(rule => rule.check(ast, ctx))
}
