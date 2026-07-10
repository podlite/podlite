import { parse, validatePodliteAst } from '@podlite/schema'
import { scanSourceRules } from 'podlite/lib/lint/grammar/scan'
import { DEFAULT_RULES } from 'podlite/lib/lint/rules/index'
import { runRules } from 'podlite/lib/lint/engine'
import { parseContent } from 'podlite/lib/lint/loader'
import { makeSyntaxViolation } from 'podlite/lib/lint/rules/syntax-valid'
import type { LintContext, Violation } from 'podlite/lib/lint/types'

export type ValidateReport = {
  ok: boolean
  counts: { error: number; warning: number; info: number }
  problems: Violation[]
}

const virtualFile = 'input.podlite'

export const parseSource = (text: string) => parse(text)

export const validateSource = (text: string): ValidateReport => {
  const problems: Violation[] = [...scanSourceRules(text)]
  try {
    const ast = parseContent(text, 'podlite')
    const ctx: LintContext = { filePath: virtualFile, fileType: 'podlite', config: {} }
    problems.push(...runRules(ast, DEFAULT_RULES, ctx))
    for (const err of validatePodliteAst(ast)) {
      problems.push({
        rule: 'schema-valid',
        severity: 'error',
        message: [err.instancePath, err.message].filter(Boolean).join(' '),
      })
    }
  } catch (e) {
    problems.push(makeSyntaxViolation(e, virtualFile))
  }
  const counts = { error: 0, warning: 0, info: 0 }
  for (const p of problems) counts[p.severity] += 1
  return { ok: counts.error === 0, counts, problems }
}
