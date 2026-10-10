import type { PodliteDocument } from '@podlite/schema'
import type { Rule, LintContext, Violation } from './types'
import { applyConfig, isRuleOff } from './config'

// The context of one pass of the rules over one file. Rules that read the
// assembled document share one assembly inside it; a rule checked on its own
// gets no sharing, so a host that changes its files sees the change.
const passes = new WeakSet<LintContext>()
export const isOnePass = (ctx: LintContext): boolean => passes.has(ctx)

export function runRules(ast: PodliteDocument, rules: Rule[], ctx: LintContext): Violation[] {
  const active = rules.filter(rule => !isRuleOff(ctx.config, rule.id))
  const pass = { ...ctx }
  passes.add(pass)
  return applyConfig(
    active.flatMap(rule => rule.check(ast, pass)),
    ctx.config,
  )
}
