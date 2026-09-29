import { dirname, relative, resolve } from 'path'
import { podlitePluggable, PodliteDocument } from '@podlite/schema'
import { PluginRegister as markdown } from '@podlite/markdown'
import { PluginRegister as toc } from '@podlite/toc'
import type { Rule, Violation, LintContext } from '../types'
import { detectFileType } from '../loader'
import { resolveIncludes, IncludeProblem } from '../../resolve-includes'
import { silently } from '../../assemble'
import { readerFor } from '../../reader'

// The plugins that change what an include can select or address. The registry
// convert raises brings the diagram renderer, and the image plugin brings React:
// a check loads neither.
export const includePlugins = { ...markdown, ...toc }
const read = readerFor(podlitePluggable({ plugins: includePlugins }), { format: detectFileType })

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
    // an include that loses its content is an error; one that still brings it in, a warning
    severity:
      problem.kind === 'source' || problem.kind === 'address' || problem.kind === 'operand' ? 'error' : 'warning',
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
        parse: (source, file, config) => silently(() => read(source, file, config)),
        tolerant: true,
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
