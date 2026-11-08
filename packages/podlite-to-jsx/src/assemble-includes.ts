import { ConfigItem, ConfigScope, markGuarded, parseSelector } from '@podlite/schema'
import { rebuildToc } from '@podlite/toc'
import { assembleIncludes as assemble, readerFor } from 'podlite'
import type { IncludeOrigin, IncludeProblem, Sources } from 'podlite'

// `undefined` from either says the answer is not known yet: the include waits,
// and nothing is said about it
export type IncludeReader = (path: string, baseDir?: string) => string | null | undefined
export type ExpandPaths = (pattern: string, baseDir?: string) => string[] | undefined

export type AssembleOptions = {
  includeReader: IncludeReader
  // only the includes with no source are resolved: the host has no files to give
  onlySameDocument?: boolean
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

const isAbsolute = (p: string): boolean => p.startsWith('/')

// a path with its . and .. steps taken; a relative one keeps the .. it cannot take
const normalize = (p: string): string => {
  const parts: string[] = []
  for (const part of p.split('/')) {
    if (part === '' || part === '.') continue
    if (part !== '..') parts.push(part)
    else if (parts.length && parts[parts.length - 1] !== '..') parts.pop()
    else if (!isAbsolute(p)) parts.push('..')
  }
  return isAbsolute(p) ? `/${parts.join('/')}` : parts.join('/')
}

const joinPath = (dir: string, p: string): string => normalize(isAbsolute(p) || dir === '' ? p : `${dir}/${p}`)

const dirOf = (p: string): string => {
  const at = p.lastIndexOf('/')
  return at === -1 ? '' : at === 0 ? '/' : p.slice(0, at)
}

const stepsOf = (p: string): string[] => p.split('/').filter(Boolean)

// the way from one directory to a path, when it can be told from the two
const relativeTo = (from: string, to: string): string | undefined => {
  if (isAbsolute(from) !== isAbsolute(to)) return undefined
  const a = stepsOf(from)
  const b = stepsOf(to)
  let same = 0
  while (same < a.length && same < b.length && a[same] === b[same]) same++
  if (a.slice(same).includes('..')) return undefined
  return [...a.slice(same).map(() => '..'), ...b.slice(same)].join('/')
}

// the part of a mask before its first step with a mask, as the disk provider of the core takes it
const fixedPrefix = (written: string): string => {
  const parts = written.split('/')
  const upto = parts.findIndex(isGlobPattern)
  return parts.slice(0, upto === -1 ? parts.length : upto).join('/')
}

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

  // an answer was not known yet: what is said now would be said again later
  let waiting = false

  // With an absolute base a file is its absolute path, as for convert; without
  // one it is its path from the directory of the document.
  const given = opts.includeBaseDir
  const base = given !== undefined && isAbsolute(given) ? normalize(given) : undefined
  const documentContext = base ?? ''
  const contextOf = (file: string): string => (file === DOCUMENT ? documentContext : dirOf(file))
  // the path the host is asked by: from the base when the file is under it
  const hostPath = (id: string): string => {
    if (base === undefined) return id
    if (base === '/') return id.slice(1)
    return id.startsWith(`${base}/`) ? id.slice(base.length + 1) : id
  }
  const unplaced = new Set<string>()

  const sources: Sources = {
    locate: (written, context, plain, at) => {
      const dir = String(context)
      const masked = !plain && isGlobPattern(written) && Boolean(opts.expandPaths)
      if (!masked || !opts.expandPaths) {
        const id = joinPath(dir, written)
        return { masked, sources: [{ id, name: written, context: dirOf(id) }] }
      }
      let expanded: string[] | undefined
      try {
        expanded = opts.expandPaths(hostPath(joinPath(dir, written)), opts.includeBaseDir)
      } catch (e) {
        return { masked, sources: [], failed: String((e as Error)?.message ?? e) }
      }
      if (expanded === undefined) {
        waiting = true
        return undefined
      }
      const prefix = fixedPrefix(written)
      const found = expanded.flatMap(answer => {
        const id = joinPath(documentContext, answer)
        const rest = relativeTo(joinPath(dir, prefix), id)
        if (rest === undefined) {
          unplaced.add(answer)
          return []
        }
        // the fixed part is glued as written, so the selector matches the name back
        return [{ id, name: prefix ? `${prefix}/${rest}` : rest, context: dirOf(id) }]
      })
      if (at)
        expansions.set(
          stepOf(at.file, at.location?.start?.offset),
          found.map(source => hostPath(source.id)),
        )
      return { masked, sources: found }
    },
    read: source => {
      try {
        const text = opts.includeReader(hostPath(source.id), opts.includeBaseDir)
        if (text === undefined) waiting = true
        return text
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
    const dir = contextOf(problem.chain[problem.chain.length - 1]?.file ?? DOCUMENT)
    const reasonOf = (path: string): string | undefined => reasons.get(joinPath(dir, path))
    const base = (): string => {
      if (problem.kind === 'set-target') return `=set before =include has no target block: ${names(problem.lost)}`
      if (problem.kind === 'unparsed-selector' && !problem.target) return 'include selector cannot be read: (empty)'
      if (problem.kind === 'unparsed-selector' || problem.kind === 'unsupported-scheme' || problem.kind === 'cycle') {
        return `include is not resolved: ${problem.target}`
      }
      if (problem.kind === 'source') {
        const cut = problem.message.split('; =set assignments not applied:')[0]
        if (cut.startsWith('include target not found')) {
          const reason = reasonOf(written)
          return reason !== undefined
            ? `include target cannot be read: ${written}: ${reason}`
            : `include is not resolved: ${problem.target}`
        }
        const reason = reasonOf(cut.replace('include target cannot be read: ', ''))
        return reason !== undefined ? `${cut}: ${reason}` : cut
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
    return steps.flatMap((step, i) => expansions.get(step) ?? [hostPath(files[i])])
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
    context: documentContext,
    file: DOCUMENT,
    parse: readerFor(opts.parser),
    origin,
    tolerant: true,
    onlySameDocument: opts.onlySameDocument,
    onError: problem => problems.push(problem),
    onWarning: problem => problems.push(problem),
  })
  if (!waiting) {
    problems.forEach(problem => warn(said(problem)))
    unplaced.forEach(answer =>
      warn(`include mask gave a path that cannot be matched without an absolute base directory: ${answer}`),
    )
  }
  const hasIncluded = (node: any): boolean => {
    if (!node || typeof node !== 'object') return false
    if (Array.isArray(node)) return node.some(hasIncluded)
    return Boolean(origin.get(node)?.via) || hasIncluded(node.content)
  }
  const done = hasIncluded(assembled) ? rebuildOwnTocs(assembled) : assembled
  markStacks(done)
  return { tree: done, stacks }
}
