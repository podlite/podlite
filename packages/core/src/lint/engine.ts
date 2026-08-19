import type { PodliteDocument } from '@podlite/schema'
import type { Rule, LintContext, Violation } from './types'
import { applyConfig, isRuleOff } from './config'

export function runRules(ast: PodliteDocument, rules: Rule[], ctx: LintContext): Violation[] {
  const active = rules.filter(rule => !isRuleOff(ctx.config, rule.id))
  return applyConfig(
    active.flatMap(rule => rule.check(ast, ctx)),
    ctx.config,
  )
}
