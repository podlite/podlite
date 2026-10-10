import { dirname, posix, relative, resolve } from 'path'
import { podlitePluggable, PodliteDocument } from '@podlite/schema'
import { PluginRegister as markdown } from '@podlite/markdown'
import { PluginRegister as toc } from '@podlite/toc'
import type { Rule, Violation, LintContext } from '../types'
import { detectFileType } from '../loader'
import { resolveIncludes, IncludeProblem } from '../../resolve-includes'
import { assembleIncludes, silently } from '../../assemble'
import type { IncludeOrigin } from '../../assemble'
import { readerFor } from '../../reader'
import type { ReadFormat } from '../../file-format'

// The plugins that change what an include can select or address. The registry
// convert raises brings the diagram renderer, and the image plugin brings React:
// a check loads neither.
export const includePlugins = { ...markdown, ...toc }
const read = readerFor(podlitePluggable({ plugins: includePlugins }), { format: detectFileType })

export const INCLUDE_RESOLVES_RULE_ID = 'include-resolves'

// A problem deep in an included file is reported at the directive of this file
// it came through, so the report and lint-ignore read offsets of this file only.
// A file of a host's own set is named as the host named it: from the root the
// paths of the document are resolved from.
export const includedName = (file: string, ctx: LintContext): string =>
  ctx.fromDisk && !ctx.sources
    ? relative(dirname(resolve(ctx.filePath)), file)
    : typeof ctx.context === 'string'
    ? posix.relative(posix.join('/', ctx.context), posix.join('/', file))
    : file

const toViolation = (problem: IncludeProblem, ctx: LintContext): Violation => {
  const first = problem.chain[0]
  const last = problem.chain[problem.chain.length - 1]
  const inner =
    problem.chain.length > 1 && last.location ? ` (in ${includedName(last.file, ctx)}:${last.location.start.line})` : ''
  return {
    rule: INCLUDE_RESOLVES_RULE_ID,
    // an include that loses its content is an error; one that still brings it in, a warning
    severity:
      problem.kind === 'source' || problem.kind === 'address' || problem.kind === 'operand' || problem.kind === 'format'
        ? 'error'
        : 'warning',
    message: `${problem.message}${inner}`,
    location: first?.location,
  }
}

export type Assembled = { tree: PodliteDocument; origin: WeakMap<object, IncludeOrigin>; problems: IncludeProblem[] }

// One assembly per file and run: the context is made anew for each file, and the
// same tree read against another set of files assembles differently.
const assembledIn = new WeakMap<LintContext, { ast: PodliteDocument; result: Assembled | Error | undefined }>()

/*
=begin pod :kind<export>

=head2 assembleForLint

The document as its includes assemble it, the file each placed node came from,
and the problems met on the way, for the rules of one lint run. Undefined where
includes are not assembled: a Markdown document, and text handed in by name with
no files given next to it. An assembly that fails is returned as the error.

=end pod
*/
export const assembleForLint = (ast: PodliteDocument, ctx: LintContext): Assembled | Error | undefined => {
  const known = assembledIn.get(ctx)
  if (known && known.ast === ast) return known.result
  const result = assemble(ast, ctx)
  assembledIn.set(ctx, { ast, result })
  return result
}

const assemble = (ast: PodliteDocument, ctx: LintContext): Assembled | Error | undefined => {
  // A markdown document has no directives: an =include line there is text.
  if (ctx.fileType === 'md') return undefined
  // text handed in by name has nothing next to it to read, unless the host
  // gives the sources itself
  if (!ctx.fromDisk && !ctx.sources) return undefined
  const problems: IncludeProblem[] = []
  const origin = new WeakMap<object, IncludeOrigin>()
  const parse = (source: string, file: string, config?: Parameters<typeof read>[2], how?: { format?: ReadFormat }) =>
    silently(() => read(source, file, config, { format: how?.format }))
  try {
    const tree = ctx.sources
      ? assembleIncludes(ast, {
          sources: ctx.sources,
          context: ctx.context ?? '',
          parse,
          tolerant: true,
          file: ctx.filePath,
          self: ctx.self,
          origin,
          onError: problem => problems.push(problem),
          onWarning: problem => problems.push(problem),
        })
      : resolveIncludes(ast, {
          baseDir: dirname(resolve(ctx.filePath)),
          parse,
          tolerant: true,
          file: resolve(ctx.filePath),
          self: ctx.filePath,
          origin,
          onError: problem => problems.push(problem),
          onWarning: problem => problems.push(problem),
        })
    return { tree, origin, problems }
  } catch (e) {
    return e instanceof Error ? e : new Error(String(e))
  }
}

export const includeResolvesRule: Rule = {
  id: INCLUDE_RESOLVES_RULE_ID,
  severity: 'error',
  check: (ast: PodliteDocument, ctx: LintContext): Violation[] => {
    const assembled = assembleForLint(ast, ctx)
    if (assembled === undefined) return []
    if (assembled instanceof Error) {
      return [
        {
          rule: INCLUDE_RESOLVES_RULE_ID,
          severity: 'error',
          message: `Includes could not be checked: ${assembled.message}`,
        },
      ]
    }
    return assembled.problems.map(problem => toViolation(problem, ctx))
  },
}
