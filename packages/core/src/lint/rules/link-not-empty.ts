import { PodliteDocument } from '@podlite/schema'
import type { Rule, Violation, LintContext } from '../types'
import { collectLinks } from './link-targets'

export const LINK_NOT_EMPTY_RULE_ID = 'link-not-empty'

export const linkNotEmptyRule: Rule = {
  id: LINK_NOT_EMPTY_RULE_ID,
  severity: 'error',
  check: (ast: PodliteDocument, _ctx: LintContext): Violation[] =>
    collectLinks(ast)
      .filter(({ target }) => target === '')
      .map(({ at }) => ({
        rule: LINK_NOT_EMPTY_RULE_ID,
        severity: 'error' as const,
        message: 'Link has no address to go to',
        location: at,
      })),
}
