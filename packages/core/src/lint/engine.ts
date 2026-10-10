import type { PodliteDocument } from '@podlite/schema'
import type { Rule, LintContext, Violation } from './types'
import { applyConfig, isRuleOff } from './config'

const passes = new WeakSet<LintContext>()

/*
=begin pod :kind<export>

=head2 isOnePass

Whether a context is the one C<runRules> gives the rules while it runs them over
one file. Rules that read the assembled document share one assembly only inside
such a pass; once the pass is over the context no longer counts as one, so a
rule checked on its own, or with a context kept from a pass, reads the files
anew.

=end pod
*/
export const isOnePass = (ctx: LintContext): boolean => passes.has(ctx)

export function runRules(ast: PodliteDocument, rules: Rule[], ctx: LintContext): Violation[] {
  const active = rules.filter(rule => !isRuleOff(ctx.config, rule.id))
  const pass = { ...ctx }
  passes.add(pass)
  try {
    return applyConfig(
      active.flatMap(rule => rule.check(ast, pass)),
      ctx.config,
    )
  } finally {
    passes.delete(pass)
  }
}
