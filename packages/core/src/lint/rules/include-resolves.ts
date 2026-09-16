import { dirname, relative, resolve } from 'path'
import { PodliteDocument } from '@podlite/schema'
import type { Rule, Violation, LintContext } from '../types'
import { detectFileType, parseContent } from '../loader'
import { resolveIncludes, IncludeProblem } from '../../resolve-includes'

export const INCLUDE_RESOLVES_RULE_ID = 'include-resolves'

// A problem deep in an included file is reported at the directive of this file
// it came through, so the report and lint-ignore read offsets of this file only.
const toViolation = (problem: IncludeProblem, filePath: string): Violation => {
  const first = problem.chain[0]
  const last = problem.chain[problem.chain.length - 1]
  const inner =
    problem.chain.length > 1 && last.location
      ? ` (in ${relative(dirname(resolve(filePath)), last.file)}:${last.location.start.line})`
      : ''
  return {
    rule: INCLUDE_RESOLVES_RULE_ID,
    severity: problem.kind === 'ambiguous' ? 'warning' : 'error',
    message: `${problem.message}${inner}`,
    location: first?.location,
  }
}

export const includeResolvesRule: Rule = {
  id: INCLUDE_RESOLVES_RULE_ID,
  severity: 'error',
  check: (ast: PodliteDocument, ctx: LintContext): Violation[] => {
    // A markdown document has no directives: an =include line there is text.
    if (!ctx.fromDisk || ctx.fileType === 'md') return []
    const problems: IncludeProblem[] = []
    try {
      resolveIncludes(ast, {
        baseDir: dirname(resolve(ctx.filePath)),
        parse: (source, file) => parseContent(source, detectFileType(file)),
        file: resolve(ctx.filePath),
        self: ctx.filePath,
        onError: problem => problems.push(problem),
        onWarning: problem => problems.push(problem),
      })
    } catch (e) {
      return [
        {
          rule: INCLUDE_RESOLVES_RULE_ID,
          severity: 'error',
          message: `Includes could not be checked: ${(e as Error).message}`,
        },
      ]
    }
    return problems.map(problem => toViolation(problem, ctx.filePath))
  },
}
