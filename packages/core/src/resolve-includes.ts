import * as fs from 'fs'
import * as path from 'path'
import {
  applySetToFirst,
  isSetTransparent,
  bindTarget,
  ConfigItem,
  buildBindingIndex,
  filePathMatches,
  getTextContentFromNode,
  Location,
  mergeSet,
  outermost,
  parseSelector,
  runSelector,
  SelectorDoc,
  PodNode,
  SelectorError,
} from '@podlite/schema'

// One directive on the way from the document to the problem: the file it is
// written in and where.
export type IncludeStep = {
  file: string
  location?: Location
}

export type IncludeProblem = {
  kind:
    | 'source'
    | 'address'
    | 'ambiguous'
    | 'unparsed-selector'
    | 'unsupported-scheme'
    | 'operand'
    // an include that brings nothing because every file it names is already on
    // the way; reported only when =set assignments are lost with it
    | 'cycle'
    // =set assignments before an include that found no block to receive them
    | 'set-target'
  target: string
  message: string
  // the first step is the directive in the document itself, the last one the
  // directive the problem was found at
  chain: IncludeStep[]
}

export type IncludeOrigin = {
  file: string
  text: string
}

// Where included text comes from. A file is named by its absolute path; a
// listing names files relative to the directory asked for.
export type SourceProvider = {
  read: (file: string) => string | null
  list: (dir: string, deep: boolean) => string[]
}

export type ResolveIncludesOptions = {
  baseDir: string
  parse: (source: string, file: string) => any
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
  // the disk when not given
  provider?: SourceProvider
}

export const isWarning = (problem: IncludeProblem): boolean =>
  problem.kind === 'ambiguous' ||
  problem.kind === 'unparsed-selector' ||
  problem.kind === 'unsupported-scheme' ||
  problem.kind === 'cycle' ||
  problem.kind === 'set-target'

const isIncludeBlock = (node: any): boolean =>
  node && typeof node === 'object' && node.type === 'block' && node.name === 'include'

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

const keepBlocks = (items: Array<SelectorDoc | PodNode>): PodNode[] =>
  items.filter(item => item && typeof item === 'object' && !('file' in item)) as PodNode[]

const unwrapRoot = (blocks: PodNode[]): PodNode[] =>
  blocks.flatMap((b: any) =>
    b && b.type === 'block' && b.name === 'root' && Array.isArray(b.content) ? b.content : [b],
  )

// A parser may hand back a list of nodes rather than a document; a selection
// needs one node to walk, and it must hold the parsed nodes themselves.
const asDocument = (tree: any): any =>
  Array.isArray(tree) ? { type: 'block', name: 'root', margin: '', content: tree } : tree

const recordOrigin = (tree: any, where: IncludeOrigin, origin: WeakMap<object, IncludeOrigin>): void => {
  const visit = (node: any): void => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(visit)
    if (!origin.has(node)) origin.set(node, where)
    // a Markdown section holds its parsed blocks in one node, not in a list
    visit(node.content)
  }
  visit(tree)
}

const readSource = (target: string): string | null => {
  try {
    return fs.statSync(target).isFile() ? fs.readFileSync(target, 'utf-8') : null
  } catch {
    return null
  }
}

export const diskProvider: SourceProvider = { read: readSource, list: (dir, deep) => listDir(dir, deep) }

export const resolveIncludes = (tree: any, opts: ResolveIncludesOptions): any => {
  const { origin } = opts
  const provider = opts.provider ?? diskProvider
  const mainFile = opts.file ?? '<document>'
  if (origin && opts.text !== undefined) recordOrigin(tree, { file: mainFile, text: opts.text }, origin)

  // Read once per call: a file brought in twice is parsed twice, so each place it
  // lands holds nodes of its own.
  const texts = new Map<string, string | null>()
  const textOf = (target: string): string | null => {
    if (!texts.has(target)) texts.set(target, provider.read(target))
    return texts.get(target) ?? null
  }

  const emit = (problem: IncludeProblem): void => {
    if (isWarning(problem)) {
      opts.onWarning?.(problem)
      return
    }
    if (!opts.onError) throw new Error(problem.message)
    opts.onError(problem)
  }

  // Problems are held until the walk ends, in the order met: an include whose
  // content came to nothing because an include inside it failed fails too, and
  // the assignments it loses are named in that inner report, which by then has
  // been made.
  type Held = { problem: IncludeProblem; shown: boolean }
  const held: Held[] = []
  const report = (problem: IncludeProblem): void => {
    held.push({ problem, shown: true })
  }
  // the problems of each failed include, in the order met
  const failures: Held[][] = []
  // Where an include failed, the search for a target stops: a directive left in
  // the tree is known by its node, one that left nothing by a mark put in its
  // place and taken out when the walk ends.
  const failedAt = new WeakMap<object, Held[]>()
  const FAILED = 'include-failed'
  const isMark = (node: any): boolean => node && typeof node === 'object' && node.type === FAILED
  const firstStop = (nodes: any[]): Held[] | undefined => {
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue
      const failed = failedAt.get(node)
      if (failed) return failed
      if (node.type === 'block' && (node.name === 'root' || node.name === '_folded_section')) {
        const inner = Array.isArray(node.content) ? node.content : node.content ? [node.content] : []
        const found = firstStop(inner)
        if (found !== undefined) return found
        if (inner.some((n: any) => n && n.type === 'block' && !isSetTransparent(n))) return undefined
        continue
      }
      if (node.type !== 'block' || isSetTransparent(node)) continue
      return undefined
    }
    return undefined
  }
  const unmark = (node: any): any => {
    if (Array.isArray(node)) {
      for (let i = node.length - 1; i >= 0; i--) {
        if (isMark(node[i])) node.splice(i, 1)
        else unmark(node[i])
      }
      return node
    }
    if (node && typeof node === 'object' && Array.isArray(node.content)) unmark(node.content)
    return node
  }
  const lose = (entries: Held[], set: ConfigItem[]): void => {
    const final = entries[entries.length - 1].problem
    final.message = `${final.message}; =set assignments not applied: ${names(set)}`
    // a cycle is reported when it loses assignments; otherwise it is left
    // alone, as before
    entries.forEach(entry => (entry.shown = true))
  }

  const names = (set: ConfigItem[]): string => set.map(c => c.name).join(', ')

  // A directive left in the tree no longer waits for its assignments: they were
  // for the content it failed to bring.
  const withoutSet = (node: any): any => {
    if (!node.set) return node
    const { set, ...rest } = node
    const known = origin?.get(node)
    if (origin && known) origin.set(rest, known)
    return rest
  }

  // `home` is the file a directive is written in: an operand of a selector
  // without a source, or with data:, reads from it. The =set assignments before
  // an include go to the first block it brings; when it brings none they go on
  // to the next block of the same list, and when it fails they go nowhere and
  // the failure says so.
  const walkList = (
    list: any[],
    baseDir: string,
    stack: string[],
    chain: IncludeStep[],
    file: string,
    home: any,
  ): any[] => {
    const out: any[] = []
    let pending: ConfigItem[] = []
    let last: { chain: IncludeStep[]; selector: string } | undefined
    for (const n of list) {
      if (isIncludeBlock(n)) {
        // assignments carried from an earlier include are older than its own
        const set = mergeSet(pending, n.set)
        pending = []
        const here = [...chain, { file, location: n.location }]
        const { nodes, failure, inner, selector } = resolveInclude(n, baseDir, stack, here, file, home)
        if (failure) {
          const entries = failure.map(problem => ({ problem, shown: problem.kind !== 'cycle' }))
          held.push(...entries)
          failures.push(entries)
          if (set.length) lose(entries, set)
          const stops = nodes.length ? nodes : [{ type: FAILED }]
          stops.forEach(stop => failedAt.set(stop, entries))
          out.push(...stops)
          continue
        }
        if (!set.length) {
          out.push(...nodes)
          continue
        }
        // an include inside that failed before any block stops the search
        const stopped = firstStop(nodes)
        if (stopped) {
          lose(stopped, set)
          out.push(...nodes)
          continue
        }
        const applied = applySetToFirst(nodes, set, { mode: 'include', origin })
        out.push(...applied.nodes)
        if (applied.outcome !== 'none') continue
        // nothing came in because an include inside failed: what it would
        // have brought is not known, and the assignments go nowhere
        if (inner.length) {
          lose(inner[inner.length - 1], set)
          continue
        }
        pending = set
        last = { chain: here, selector }
        continue
      }
      const walked = walkNode(n, baseDir, stack, chain, file, home)
      const items = Array.isArray(walked) ? walked : [walked]
      if (!pending.length) {
        out.push(...items)
        continue
      }
      const stopped = firstStop(items)
      if (stopped) {
        lose(stopped, pending)
        pending = []
        out.push(...items)
        continue
      }
      const applied = applySetToFirst(items, pending, { mode: 'carry', origin })
      if (applied.outcome !== 'none') pending = []
      out.push(...applied.nodes)
    }
    if (pending.length && last) {
      report({
        kind: 'set-target',
        target: last.selector,
        message: `=set before =include has no target block in scope: ${names(pending)}`,
        chain: last.chain,
      })
    }
    return out
  }

  // What an include comes to: the nodes that take its place, or the problems
  // that left it with nothing, not yet reported
  const resolveInclude = (
    node: any,
    baseDir: string,
    stack: string[],
    here: IncludeStep[],
    file: string,
    home: any,
  ): { nodes: any[]; failure?: IncludeProblem[]; inner: Held[][]; selector: string } => {
    const mark = failures.length
    const done = (nodes: any[], failure?: IncludeProblem[]) => ({
      nodes,
      failure,
      inner: failures.slice(mark),
      selector,
    })
    const selector = getTextContentFromNode(node.content)?.toString().trim() ?? ''
    const parsed = selector ? parseSelector(selector) : undefined
    // The directive stays in the tree as before when its selector is not read;
    // what it would have brought in is missing, and a reader of the tree cannot
    // tell that on its own.
    const fail = (problem: IncludeProblem, keep = false) => done(keep ? [withoutSet(node)] : [], [problem])
    if (!selector || !parsed || !parsed.scheme || !parsed.document) {
      return fail(
        {
          kind: 'unparsed-selector',
          target: selector,
          message: `include selector cannot be read: ${selector || '(empty)'}`,
          chain: here,
        },
        true,
      )
    }
    if (parsed.scheme !== 'file') {
      return fail(
        {
          kind: 'unsupported-scheme',
          target: selector,
          message: `include scheme is not supported: ${parsed.scheme}:`,
          chain: here,
        },
        true,
      )
    }

    const masked = hasMask(parsed.document)
    const written = masked ? expandMask(parsed.document, baseDir, provider) : [parsed.document]
    if (!masked && textOf(path.resolve(baseDir, parsed.document)) === null) {
      return fail({
        kind: 'source',
        target: selector,
        message: `include target not found: ${parsed.document}`,
        chain: here,
      })
    }

    const docs: Array<{ file: string; node: any }> = []
    const unread: IncludeProblem[] = []
    let cyclic = false
    for (const name of written) {
      const target = path.resolve(baseDir, name)
      if (stack.includes(target)) {
        cyclic = true
        continue
      }
      const text = textOf(target)
      if (text === null) {
        unread.push({
          kind: 'source',
          target: selector,
          message: `include target cannot be read: ${name}`,
          chain: here,
        })
        continue
      }
      const own = opts.parse(text, target)
      if (origin) recordOrigin(own, { file: target, text }, origin)
      docs.push({
        file: name,
        node: asDocument(walkNode(own, path.dirname(target), [...stack, target], here, target, own)),
      })
    }
    if (docs.length === 0) {
      // a mask that names no file holds no address
      if (parsed.anchor && written.length === 0) {
        return fail({
          kind: 'address',
          target: selector,
          message: `include address not found: #${parsed.anchor} in ${parsed.document}`,
          chain: here,
        })
      }
      if (unread.length) return done([], unread)
      if (cyclic) {
        return fail({
          kind: 'cycle',
          target: selector,
          message: `include brings nothing: ${parsed.document} is already being included`,
          chain: here,
        })
      }
      return done([])
    }
    // the files that were read stand; the others are reported as before
    unread.forEach(report)

    if (parsed.anchor) {
      // The address is found the way a link finds its target, in the file as it
      // stands once its own includes are in; a selection after it is not applied.
      const found: object[] = []
      for (const doc of docs) {
        const binding = bindTarget(parsed.anchor, buildBindingIndex(doc.node))
        if (!binding.found) continue
        if (binding.ambiguous) {
          report({
            kind: 'ambiguous',
            target: selector,
            message: `include address #${parsed.anchor} names more than one block in ${doc.file}`,
            chain: here,
          })
        }
        found.push(binding.node)
      }
      if (found.length > 0) return done(found)
      return fail({
        kind: 'address',
        target: selector,
        message: `include address not found: #${parsed.anchor} in ${parsed.document}`,
        chain: here,
      })
    }

    // a file an operand names is read the way an included file is, from the
    // directory of the directive; one already on the way does not resolve
    const readFile = (document: string): SelectorDoc[] | undefined => {
      const target = path.resolve(baseDir, document)
      const text = stack.includes(target) ? null : textOf(target)
      if (text === null) return undefined
      const own = opts.parse(text, target)
      if (origin) recordOrigin(own, { file: target, text }, origin)
      return [
        {
          file: document,
          node: asDocument(walkNode(own, path.dirname(target), [...stack, target], here, target, own)),
        },
      ]
    }
    try {
      return done(
        unwrapRoot(
          outermost(keepBlocks(runSelector(selector, docs, { home: [{ file, node: asDocument(home) }], readFile }))),
        ),
      )
    } catch (e) {
      if (!(e instanceof SelectorError)) throw e
      return fail({
        kind: 'operand',
        target: selector,
        message: `include selector cannot be read: ${e.message}`,
        chain: here,
      })
    }
  }

  const walkNode = (
    node: any,
    baseDir: string,
    stack: string[],
    chain: IncludeStep[],
    file: string,
    home: any,
  ): any => {
    if (!node || typeof node !== 'object') return node
    if (Array.isArray(node)) return walkList(node, baseDir, stack, chain, file, home)
    if (isIncludeBlock(node)) return walkList([node], baseDir, stack, chain, file, home)

    if (Array.isArray(node.content)) {
      const copy = { ...node, content: walkList(node.content, baseDir, stack, chain, file, home) }
      const known = origin?.get(node)
      if (origin && known) origin.set(copy, known)
      return copy
    }
    return node
  }

  const result = unmark(walkNode(tree, opts.baseDir, opts.self ? [path.resolve(opts.self)] : [], [], mainFile, tree))
  held.filter(entry => entry.shown).forEach(entry => emit(entry.problem))
  return result
}
