import { ConfigItem, ConfigScope, markGuarded, parseSelector } from '@podlite/schema'
import { rebuildToc } from '@podlite/toc'
import { assembleIncludes as assemble } from 'podlite'
import type { IncludeOrigin, IncludeProblem, Sources } from 'podlite'

export type IncludeReader = (path: string, baseDir?: string) => string | null
export type ExpandPaths = (pattern: string, baseDir?: string) => string[]

export type AssembleOptions = {
  includeReader: IncludeReader
  includeBaseDir?: string
  expandPaths?: ExpandPaths
  parser: {
    parse: (source: string, opts: any) => any
    toAst: (tree: any, opts?: { config?: ConfigScope }) => any
  }
}

export type Assembly = {
  tree: any
  // the files an included node came through, outermost first; a node of the
  // document itself has none
  stacks: WeakMap<object, string[]>
}

const isGlobPattern = (s: string): boolean => /[*?[]/.test(s)

const isBlock = (node: any, name?: string): boolean =>
  Boolean(node && typeof node === 'object' && node.type === 'block' && (name === undefined || node.name === name))

const isToc = (node: any): boolean => isBlock(node, 'toc') || isBlock(node, 'Toc')

const warn = (message: string): void => console.warn(`[to-jsx] ${message}`)

// the marks set later change nodes in place, and the tree given is not ours
const deepCopy = (node: any): any => {
  if (Array.isArray(node)) return node.map(deepCopy)
  if (!node || typeof node !== 'object') return node
  const copy: any = {}
  for (const key of Object.keys(node)) copy[key] = deepCopy(node[key])
  return copy
}

// the name the document itself goes by among the files on the way
const DOCUMENT = ''

/*
=begin pod :kind<export>

=head2 assembleIncludes

Puts the blocks each C<=include> finds in its place in the list that holds it,
as C<convert> does and by the same assembly, before anything is rendered:
selectors, tables of contents and links then see the included blocks as blocks
of the document. The host is asked for a file by the path as written, once for
each file. An include that does not resolve is reported once, by a warning. The
tree given is not changed.

Returns the assembled tree and, for each included node, the files it came
through.

=end pod
*/
export const assembleIncludes = (tree: any, opts: AssembleOptions): Assembly => {
  const origin = new WeakMap<object, IncludeOrigin>()
  // why a file could not be read, when the reader threw
  const reasons = new Map<string, string>()
  // what the mask of a directive came to, by the directive
  const expansions = new Map<string, string[]>()
  const stepOf = (file: string, offset: number | undefined): string => `${file}@${offset ?? ''}`

  const sources: Sources = {
    locate: (written, _context, plain, at) => {
      const masked = !plain && isGlobPattern(written) && Boolean(opts.expandPaths)
      let paths = [written]
      if (masked && opts.expandPaths) {
        try {
          paths = opts.expandPaths(written, opts.includeBaseDir)
        } catch (e) {
          return { masked, sources: [], failed: String((e as Error)?.message ?? e) }
        }
        if (at) expansions.set(stepOf(at.file, at.location?.start?.offset), paths)
      }
      // a file is known to the host by its path as written, and paths written
      // inside it are read the same way
      return { masked, sources: paths.map(path => ({ id: path, name: path, context: path })) }
    },
    read: source => {
      try {
        return opts.includeReader(source.id, opts.includeBaseDir) ?? null
      } catch (e) {
        reasons.set(source.id, String((e as Error)?.message ?? e))
        return null
      }
    },
  }

  const names = (lost: string[] | undefined): string => (lost ?? []).join(', ')

  // the words this renderer has always said for a problem of the assembly
  const said = (problem: IncludeProblem): string => {
    const lost = problem.lost?.length ? `; =set assignments not applied: ${names(problem.lost)}` : ''
    const written = parseSelector(problem.target)?.document ?? ''
    const base = (): string => {
      if (problem.kind === 'set-target') return `=set before =include has no target block: ${names(problem.lost)}`
      if (problem.kind === 'unparsed-selector' && !problem.target) return 'include selector cannot be read: (empty)'
      if (problem.kind === 'unparsed-selector' || problem.kind === 'unsupported-scheme' || problem.kind === 'cycle') {
        return `include is not resolved: ${problem.target}`
      }
      if (problem.kind === 'source') {
        const cut = problem.message.split('; =set assignments not applied:')[0]
        if (cut.startsWith('include target not found')) {
          return reasons.has(written)
            ? `include target cannot be read: ${written}: ${reasons.get(written)}`
            : `include is not resolved: ${problem.target}`
        }
        const file = cut.replace('include target cannot be read: ', '')
        return reasons.has(file) ? `${cut}: ${reasons.get(file)}` : cut
      }
      return problem.message.split('; =set assignments not applied:')[0]
    }
    return problem.kind === 'set-target' ? base() : `${base()}${lost}`
  }

  const stacks = new WeakMap<object, string[]>()
  // The files a node came through: the file of each include on its way after
  // the document, then its own. Where a mask brought the file, every file of
  // the mask stands for it, as it always has.
  const stackOf = (where: IncludeOrigin): string[] => {
    const steps = (where.via ?? '').split('>')
    // the file each directive brought: the file the next one is written in, or the node's own
    const files = [...steps.slice(1).map(step => step.slice(0, step.lastIndexOf('@'))), where.file]
    return steps.flatMap((step, i) => expansions.get(step) ?? [files[i]])
  }
  const markStacks = (node: any): void => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(markStacks)
    const where = origin.get(node)
    if (where?.via && !stacks.has(node)) stacks.set(node, stackOf(where))
    markStacks(node.content)
  }

  // the tables of contents written in the document itself, built again over it
  const rebuildOwnTocs = (root: any): any => {
    markGuarded(root)
    const walk = (node: any): any => {
      if (!node || typeof node !== 'object') return node
      if (Array.isArray(node)) {
        const mapped = node.map(walk)
        return mapped.some((n, i) => n !== node[i]) ? mapped : node
      }
      if (isToc(node) && !origin.get(node)?.via) return rebuildToc(node, root)
      if (!Array.isArray(node.content)) return node
      const content = walk(node.content)
      if (content === node.content) return node
      const copy = { ...node, content }
      const known = origin.get(node)
      if (known) origin.set(copy, known)
      return copy
    }
    return walk(root)
  }

  const problems: IncludeProblem[] = []
  const assembled = assemble(deepCopy(tree), {
    sources,
    context: DOCUMENT,
    file: DOCUMENT,
    parse: (source, _file, config) => opts.parser.toAst(opts.parser.parse(source, { podMode: 1, config }), { config }),
    origin,
    tolerant: true,
    operandsAmongSources: true,
    onError: problem => problems.push(problem),
    onWarning: problem => problems.push(problem),
  })
  problems.forEach(problem => warn(said(problem)))
  const hasIncluded = (node: any): boolean => {
    if (!node || typeof node !== 'object') return false
    if (Array.isArray(node)) return node.some(hasIncluded)
    return Boolean(origin.get(node)?.via) || hasIncluded(node.content)
  }
  const done = hasIncluded(assembled) ? rebuildOwnTocs(assembled) : assembled
  markStacks(done)
  return { tree: done, stacks }
}
