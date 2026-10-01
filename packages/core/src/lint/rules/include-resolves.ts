import { dirname, relative, resolve } from 'path'
import { podlitePluggable, PodliteDocument } from '@podlite/schema'
import { PluginRegister as markdown } from '@podlite/markdown'
import { PluginRegister as toc } from '@podlite/toc'
import type { Rule, Violation, LintContext } from '../types'
import { detectFileType } from '../loader'
import { resolveIncludes, IncludeProblem } from '../../resolve-includes'
import { assembleIncludes, silently } from '../../assemble'
import { readerFor } from '../../reader'

// The plugins that change what an include can select or address. The registry
// convert raises brings the diagram renderer, and the image plugin brings React:
// a check loads neither.
export const includePlugins = { ...markdown, ...toc }
const read = readerFor(podlitePluggable({ plugins: includePlugins }), { format: detectFileType })

export const INCLUDE_RESOLVES_RULE_ID = 'include-resolves'

// A problem deep in an included file is reported at the directive of this file
// it came through, so the report and lint-ignore read offsets of this file only.
// A file of a host's own set is named as the host named it.
const toViolation = (problem: IncludeProblem, filePath: string, fromDisk: boolean): Violation => {
  const first = problem.chain[0]
  const last = problem.chain[problem.chain.length - 1]
  const inner =
    problem.chain.length > 1 && last.location
      ? ` (in ${fromDisk ? relative(dirname(resolve(filePath)), last.file) : last.file}:${last.location.start.line})`
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
    if (ctx.fileType === 'md') return []
    // text handed in by name has nothing next to it to read, unless the host
    // gives the sources itself
    if (!ctx.fromDisk && !ctx.sources) return []
    const problems: IncludeProblem[] = []
    const parse = (source: string, file: string, config?: Parameters<typeof read>[2]) =>
      silently(() => read(source, file, config))
    try {
      if (ctx.sources) {
        assembleIncludes(ast, {
          sources: ctx.sources,
          context: ctx.context ?? '',
          parse,
          tolerant: true,
          file: ctx.filePath,
          self: ctx.self,
          onError: problem => problems.push(problem),
          onWarning: problem => problems.push(problem),
        })
      } else {
        resolveIncludes(ast, {
          baseDir: dirname(resolve(ctx.filePath)),
          parse,
          tolerant: true,
          file: resolve(ctx.filePath),
          self: ctx.filePath,
          onError: problem => problems.push(problem),
          onWarning: problem => problems.push(problem),
        })
      }
    } catch (e) {
      return [
        {
          rule: INCLUDE_RESOLVES_RULE_ID,
          severity: 'error',
          message: `Includes could not be checked: ${(e as Error).message}`,
        },
      ]
    }
    return problems.map(problem => toViolation(problem, ctx.filePath, Boolean(ctx.fromDisk) && !ctx.sources))
  },
}
