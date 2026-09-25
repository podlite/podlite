import {
  applySetToFirst,
  ConfigItem,
  getTextContentFromNode,
  isSetTransparent,
  markGuarded,
  mergeSet,
  outermost,
  parseSelector,
  PodNode,
  runSelector,
  SelectorError,
} from '@podlite/schema'
import { rebuildToc } from '@podlite/toc'

export type IncludeReader = (path: string, baseDir?: string) => string | null
export type ExpandPaths = (pattern: string, baseDir?: string) => string[]

export type AssembleOptions = {
  includeReader: IncludeReader
  includeBaseDir?: string
  expandPaths?: ExpandPaths
  parser: { parse: (source: string, opts: any) => any; toAst: (tree: any) => any }
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

const isWrapper = (node: any): boolean => isBlock(node, 'root') || isBlock(node, '_folded_section')

const names = (set: ConfigItem[]): string => set.map(c => c.name).join(', ')

const warn = (message: string): void => console.warn(`[to-jsx] ${message}`)

// the marks set later change nodes in place, and the tree given is not ours
const deepCopy = (node: any): any => {
  if (Array.isArray(node)) return node.map(deepCopy)
  if (!node || typeof node !== 'object') return node
  const copy: any = {}
  for (const key of Object.keys(node)) copy[key] = deepCopy(node[key])
  return copy
}

/*
=begin pod :kind<export>

=head2 assembleIncludes

Puts the blocks each C<=include> finds in its place in the list that holds it,
as C<convert> does, before anything is rendered: selectors, tables of contents
and links then see the included blocks as blocks of the document. An included
file is assembled first, its own includes before the parent's selection, and its
own tables of contents are built again over it. An include that does not resolve
stays in the tree and is reported once. The C<=set> assignments written before an
include go to the first block it brings; when it brings none they go on to the
next block of the same list; when it fails, or an include that failed stands in
the way, they go nowhere and the message says so. The tree given is not changed.

Returns the assembled tree and, for each included node, the files it came
through.

=end pod
*/
export const assembleIncludes = (tree: any, opts: AssembleOptions): Assembly => {
  const stacks = new WeakMap<object, string[]>()
  // includes that were tried and left in place
  const failed = new WeakSet<object>()

  const markStack = (node: any, stack: string[]): void => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(n => markStack(n, stack))
    // a node from a deeper include already knows its own way in
    if (!stacks.has(node)) stacks.set(node, stack)
    markStack(node.content, stack)
  }

  // what an include left in place stops a search for a target: the assignments
  // it would have carried are lost with it
  const firstStop = (nodes: any[]): boolean => {
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue
      if (failed.has(node)) return true
      if (isWrapper(node)) {
        const inner = Array.isArray(node.content) ? node.content : [node.content]
        if (firstStop(inner)) return true
        if (inner.some((n: any) => isBlock(n) && !isSetTransparent(n))) return false
        continue
      }
      if (!isBlock(node) || isSetTransparent(node)) continue
      return false
    }
    return false
  }

  // the tables of contents written in this file, built again over it
  const rebuildOwnTocs = (root: any): any => {
    markGuarded(root)
    const walk = (node: any): any => {
      if (!node || typeof node !== 'object') return node
      if (Array.isArray(node)) {
        const mapped = node.map(walk)
        return mapped.some((n, i) => n !== node[i]) ? mapped : node
      }
      if (isToc(node) && !stacks.has(node)) return rebuildToc(node, root)
      if (!Array.isArray(node.content)) return node
      const content = walk(node.content)
      if (content === node.content) return node
      const copy = { ...node, content }
      const stack = stacks.get(node)
      if (stack) stacks.set(copy, stack)
      return copy
    }
    return walk(root)
  }

  // An include resolved: the blocks it brings, each file assembled first; or why
  // it brought nothing.
  const resolve = (node: any, stack: string[]): { nodes: any[] } | { failure: string } => {
    const selector = getTextContentFromNode(node.content as any)
      ?.toString()
      .trim()
    if (!selector) return { failure: 'include selector cannot be read: (empty)' }
    const parsed = parseSelector(selector)
    if (!parsed || parsed.scheme !== 'file' || !parsed.document) return { failure: `include is not resolved: ${selector}` }
    let paths: string[]
    try {
      paths =
        isGlobPattern(parsed.document) && opts.expandPaths
          ? opts.expandPaths(parsed.document, opts.includeBaseDir)
          : [parsed.document]
    } catch (e) {
      return { failure: `include mask cannot be expanded: ${parsed.document}: ${(e as Error)?.message ?? e}` }
    }
    const branch = [...stack, ...paths]
    const docs: { file: string; node: any }[] = []
    // a reader or parser that throws is a file that could not be had: it was
    // caught while rendering before, and one include must not stop the page; of
    // a mask, the files that were read stand and the other is reported, as in
    // convert
    let broken: string | undefined
    for (const p of paths) {
      if (stack.includes(p)) continue
      let own: any
      try {
        const source = opts.includeReader(p, opts.includeBaseDir)
        if (source == null) continue
        own = opts.parser.toAst(opts.parser.parse(source, { podMode: 1 }))
      } catch (e) {
        broken = `include target cannot be read: ${p}: ${(e as Error)?.message ?? e}`
        continue
      }
      docs.push({ file: p, node: assembleFile(own, branch) })
    }
    if (docs.length === 0) return { failure: broken ?? `include is not resolved: ${selector}` }
    if (broken) warn(broken)
    let found: PodNode[]
    try {
      found = outermost((runSelector(selector, docs) as PodNode[]) || [])
    } catch (e) {
      if (!(e instanceof SelectorError)) throw e
      return { failure: `include selector cannot be read: ${e.message}` }
    }
    markStack(found, branch)
    return { nodes: found }
  }

  const walkList = (list: any[], stack: string[], state: { resolved: boolean }): any[] => {
    const out: any[] = []
    let pending: ConfigItem[] = []
    for (const n of list) {
      if (isBlock(n, 'include')) {
        // assignments carried from an earlier include are older than its own
        const set = mergeSet(pending, n.set)
        pending = []
        const result = resolve(n, stack)
        if ('failure' in result) {
          warn(set.length ? `${result.failure}; =set assignments not applied: ${names(set)}` : result.failure)
          failed.add(n)
          out.push(n)
          continue
        }
        state.resolved = true
        if (!set.length) {
          out.push(...result.nodes)
          continue
        }
        if (firstStop(result.nodes)) {
          warn(`an include before the first included block failed; =set assignments not applied: ${names(set)}`)
          out.push(...result.nodes)
          continue
        }
        const applied = applySetToFirst(result.nodes, set, { mode: 'include', origin: stacks })
        out.push(...applied.nodes)
        if (applied.outcome === 'none') pending = set
        continue
      }
      const walked = walkNode(n, stack, state)
      if (!pending.length) {
        out.push(walked)
        continue
      }
      if (firstStop([walked])) {
        warn(`an include before the next block failed; =set assignments not applied: ${names(pending)}`)
        pending = []
        out.push(walked)
        continue
      }
      const applied = applySetToFirst([walked], pending, { mode: 'carry', origin: stacks })
      if (applied.outcome !== 'none') pending = []
      out.push(...applied.nodes)
    }
    if (pending.length) warn(`=set before =include has no target block: ${names(pending)}`)
    return out
  }

  const walkNode = (node: any, stack: string[], state: { resolved: boolean }): any => {
    if (!node || typeof node !== 'object') return node
    if (Array.isArray(node)) return walkList(node, stack, state)
    if (!Array.isArray(node.content)) return node
    const copy = { ...node, content: walkList(node.content, stack, state) }
    const known = stacks.get(node)
    if (known) stacks.set(copy, known)
    return copy
  }

  // one file: its includes in place, then its own tables of contents
  const assembleFile = (root: any, stack: string[]): any => {
    const state = { resolved: false }
    const assembled = walkNode(root, stack, state)
    return state.resolved ? rebuildOwnTocs(assembled) : assembled
  }

  return { tree: assembleFile(deepCopy(tree), []), stacks }
}
