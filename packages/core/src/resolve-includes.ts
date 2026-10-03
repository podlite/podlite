import * as fs from 'fs'
import * as path from 'path'
import { ConfigScope, filePathMatches } from '@podlite/schema'
import { assembleIncludes, IncludeOrigin, IncludeProblem, Sources } from './assemble'

export { isWarning } from './assemble'
export type { IncludeStep, IncludeProblem, IncludeOrigin } from './assemble'

// Where included text comes from. A file is named by its absolute path; a
// listing names files relative to the directory asked for. `real` gives the path
// a file or a directory has with links followed, or null; without it, or with no
// path for the root, nothing is outside a root.
export type SourceProvider = {
  read: (file: string) => string | null
  list: (dir: string, deep: boolean) => string[]
  real?: (file: string) => string | null
}

export type ResolveIncludesOptions = {
  baseDir: string
  // `config` holds the settings in effect at the directive that places the text
  parse: (source: string, file: string, config?: ConfigScope) => any
  // the document's name and text, for messages and for origin
  file?: string
  text?: string
  // the document's path on disk, when it was read from one: an include back to
  // it is a cycle
  self?: string
  // without it a problem that loses an include is thrown
  onError?: (problem: IncludeProblem) => void
  onWarning?: (problem: IncludeProblem) => void
  origin?: WeakMap<object, IncludeOrigin>
  // told of each copy made of a parsed node
  onCopy?: (from: object, to: object) => void
  // a text that fails to parse is a source that cannot be had, not an exception
  tolerant?: boolean
  // the disk when not given
  provider?: SourceProvider
  // a file whose real path is not under it is external
  root?: string
}

export const hasMask = (target: string): boolean => /[*?]/.test(target)

const reachesSubdirs = (target: string): boolean => target.includes('**')

// A mask that crosses directories could otherwise walk a whole disk from a
// short prefix.
const maxDepth = 32

// Everything up to the last separator that carries no mask; the rest is matched
// by the selector itself, which already knows the pattern language.
const fixedPrefix = (target: string): string => {
  const parts = target.split('/')
  const upto = parts.findIndex(hasMask)
  return parts.slice(0, upto === -1 ? parts.length : upto).join('/')
}

const listDir = (dir: string, deep: boolean, depth = 0): string[] => {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const named = entries.filter(e => !e.name.startsWith('.')).sort((a, b) => (a.name < b.name ? -1 : 1))
  const files = named.filter(e => e.isFile()).map(e => e.name)
  if (!deep || depth >= maxDepth) return files
  const nested = named
    .filter(e => e.isDirectory())
    .flatMap(e => listDir(path.join(dir, e.name), deep, depth + 1).map(inner => `${e.name}/${inner}`))
  return [...files, ...nested]
}

// Candidate paths for a masked target, written the way the target is written so
// the selector matches them back. Matching runs before the file is read: the
// directory may hold anything, and a mask that does not name it must not send
// it through the parser.
export const expandMask = (target: string, baseDir: string, provider: SourceProvider): string[] => {
  const prefix = fixedPrefix(target)
  return provider
    .list(path.resolve(baseDir, prefix), reachesSubdirs(target))
    .map(name => (prefix ? `${prefix}/${name}` : name))
    .filter(file => filePathMatches(file, target))
}

const readSource = (target: string): string | null => {
  try {
    return fs.statSync(target).isFile() ? fs.readFileSync(target, 'utf-8') : null
  } catch {
    return null
  }
}

// the native call gives the case the disk has, so a path written in another case
// still compares equal on a disk that ignores case
const realPath = (file: string): string | null => {
  try {
    return fs.realpathSync.native(file)
  } catch {
    return null
  }
}

export const diskProvider: SourceProvider = {
  read: readSource,
  list: (dir, deep) => listDir(dir, deep),
  real: realPath,
}

const isUnder = (file: string, dir: string): boolean => {
  const relative = path.relative(dir, file)
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}

// The disk and a provider of the earlier shape, as sources: a path is resolved
// against the directory of the text it is written in, and a file is its own
// absolute path.
const sourcesOf = (provider: SourceProvider, root?: string): Sources => {
  const given = root === undefined ? undefined : path.resolve(root)
  const realRoot = given === undefined ? null : provider.real?.(given) ?? null
  const outside = (id: string): string | undefined => {
    if (realRoot === null) return undefined
    const real = provider.real?.(id)
    return real && !isUnder(real, realRoot) ? `outside the root ${given}` : undefined
  }
  return {
    locate: (written, context, plain) => {
      const baseDir = String(context)
      const masked = !plain && hasMask(written)
      const names = masked ? expandMask(written, baseDir, provider) : [written]
      return {
        masked,
        sources: names.map(name => {
          const id = path.resolve(baseDir, name)
          const external = outside(id)
          return external === undefined
            ? { id, name, context: path.dirname(id) }
            : { id, name, context: path.dirname(id), external }
        }),
      }
    },
    read: source => provider.read(source.id),
  }
}

export const resolveIncludes = (tree: any, opts: ResolveIncludesOptions): any => {
  const { baseDir, provider, self, root, ...rest } = opts
  return assembleIncludes(tree, {
    ...rest,
    sources: sourcesOf(provider ?? diskProvider, root),
    context: baseDir,
    self: self ? path.resolve(self) : undefined,
  })
}

// Where a problem was met: the directive it was found at, its file as the
// command line names it, or from the working directory when absolute.
export const describeProblem = (problem: IncludeProblem): string => {
  const at = problem.chain[problem.chain.length - 1]
  const line = at?.location ? `:${at.location.start.line}` : ''
  const file = at ? (path.isAbsolute(at.file) ? path.relative(process.cwd(), at.file) : at.file) : '<document>'
  return `${file}${line}: ${problem.message}`
}
