import {
  applySetToFirst,
  isSetTransparent,
  markGuarded,
  bindTarget,
  ConfigItem,
  ConfigScope,
  mergeConfigSettings,
  propagateConfigDefaults,
  buildBindingIndex,
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
import { rebuildToc } from '@podlite/toc'

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
    // a found block that the settings at the directive read as something else
    | 'include-reading-differs'
  target: string
  message: string
  // the =set assignments the problem lost, by name
  lost?: string[]
  // the first step is the directive in the document itself, the last one the
  // directive the problem was found at
  chain: IncludeStep[]
}

export type IncludeOrigin = {
  file: string
  text: string
  // the directives the node came through inside the file it was read with
  via?: string
}

/*
=begin pod :kind<export>

=head2 Source

A text an C<=include> can bring. C<id> is its identity: two sources are the same
text when their ids are equal, and a source already on the way in is a cycle.
C<name> is what a selector matches the source by and what messages show.
C<context> is what paths written inside the source are resolved from; only the
provider reads it.

=end pod
*/
export type Source = {
  id: string
  name: string
  context: unknown
}

/*
=begin pod :kind<export>

=head2 Sources

Where included text comes from, given by the host. C<locate> finds the sources a
written path names, from the context of the text the directive is written in,
and tells whether the path is a mask: a mask may name no source, a plain path
names one. C<read> gives the text of a source, or C<null> when it cannot be had.
Either answers C<undefined> when the answer is not known yet: the include is
then left in place with its C<=set> assignments, and nothing is reported. With
C<plain> the path names one source as written, mask characters and all: an
operand of a selector is read that way.

=end pod
*/
// `failed` says why a mask could not be expanded
export type Located = { masked: boolean; sources: Source[]; failed?: string }

export type Sources = {
  // `at` is the directive the path is written in, when it is an include
  locate: (path: string, context: unknown, plain?: boolean, at?: IncludeStep) => Located | undefined
  read: (source: Source) => string | null | undefined
}

export type AssembleOptions = {
  sources: Sources
  // what the paths written in the document itself are resolved from
  context: unknown
  // `config` holds the settings in effect at the directive that places the text
  parse: (source: string, file: string, config?: ConfigScope) => any
  // the document's name and text, for messages and for origin
  file?: string
  text?: string
  // the identity of the document as a source, when it has one: an include back
  // to it is a cycle
  self?: string
  // without it a problem that loses an include is thrown
  onError?: (problem: IncludeProblem) => void
  onWarning?: (problem: IncludeProblem) => void
  origin?: WeakMap<object, IncludeOrigin>
  // told of each copy made of a parsed node
  onCopy?: (from: object, to: object) => void
  // a text that fails to parse is a source that cannot be had, not an exception
  tolerant?: boolean
}

export const isWarning = (problem: IncludeProblem): boolean =>
  problem.kind === 'ambiguous' ||
  problem.kind === 'unparsed-selector' ||
  problem.kind === 'unsupported-scheme' ||
  problem.kind === 'cycle' ||
  problem.kind === 'set-target' ||
  problem.kind === 'include-reading-differs'

/*
=begin pod :kind<export>

=head2 silently

Runs C<work> with warnings of the plugins it calls kept from the console: a text
read a second time, or read ahead of the answers it waits for, would otherwise
say the same thing again.

=end pod
*/
export const silently = <T>(work: () => T): T => {
  const warn = console.warn
  console.warn = () => {}
  try {
    return work()
  } finally {
    console.warn = warn
  }
}

const isIncludeBlock = (node: any): boolean =>
  node && typeof node === 'object' && node.type === 'block' && node.name === 'include'

const keepBlocks = (items: Array<SelectorDoc | PodNode>): PodNode[] =>
  items.filter(item => item && typeof item === 'object' && !('file' in item)) as PodNode[]

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

/*
=begin pod :kind<export>

=head2 assembleIncludes

Puts the blocks each C<=include> finds in its place. The text of an included
source comes from C<sources>; nothing is read from a disk here. A problem that
loses included content goes to C<onError>, or is thrown without it; the others
go to C<onWarning>.

=end pod
*/
export const assembleIncludes = (tree: any, opts: AssembleOptions): any => {
  const origin = opts.origin ?? new WeakMap<object, IncludeOrigin>()
  const provider = opts.sources
  const mainFile = opts.file ?? '<document>'
  if (opts.text !== undefined) recordOrigin(tree, { file: mainFile, text: opts.text }, origin)

  // Read once per call: a file brought in twice is parsed twice, so each place it
  // lands holds nodes of its own.
  const texts = new Map<string, string | null>()
  const textOf = (source: Source): string | null | undefined => {
    if (texts.has(source.id)) return texts.get(source.id) ?? null
    const text = provider.read(source)
    if (text !== undefined) texts.set(source.id, text)
    return text
  }

  const emit = (problem: IncludeProblem): void => {
    if (isWarning(problem)) {
      opts.onWarning?.(problem)
      return
    }
    if (!opts.onError) throw new Error(problem.message)
    opts.onError(problem)
  }

  // Problems are held while an entry of the document's own list is walked, in
  // the order met: an include whose content came to nothing because an include
  // inside it failed fails too, and the assignments it loses are named in that
  // inner report, which by then has been made. An error with no handler is
  // thrown at once, as it was.
  type Held = { problem: IncludeProblem; shown: boolean }
  const held: Held[] = []
  // the problem an error thrown with no handler was made from
  const thrownFrom = new WeakMap<object, Held>()
  // For each include being resolved, whether a block of its content was met
  // before the walk went on: an error thrown past it names the assignments of
  // its including file only when none was, since otherwise they may have had a
  // target. An include by an address is taken as met: the address names the
  // block whatever stands before it.
  const reached: boolean[] = []
  // A file is also read on its own, for the selection: that reading reports
  // nothing and marks no include outside it.
  let quiet = 0
  let reachedFrom = 0
  const markReached = (): void => {
    for (let i = reachedFrom; i < reached.length; i++) reached[i] = true
  }
  const hold = (entries: Held[]): void => {
    if (quiet) return
    for (const entry of entries) {
      if (entry.shown && !isWarning(entry.problem) && !opts.onError) {
        const error = new Error(entry.problem.message)
        thrownFrom.set(error, entry)
        throw error
      }
    }
    held.push(...entries)
  }
  const report = (problem: IncludeProblem): void => hold([{ problem, shown: true }])
  const flush = (): void => {
    held
      .splice(0)
      .filter(entry => entry.shown)
      .forEach(entry => emit(entry.problem))
  }
  // how many includes brought their content so far
  let brought = 0
  // how deep in lists the walk is: the document's own list is the first
  let level = 0
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
  // The block the assignments would go to, before any is given: the first that
  // is not transparent, looking inside the wrappers the tree adds.
  const firstTarget = (nodes: any[]): any => {
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue
      if (failedAt.has(node)) return node
      if (node.type === 'block' && (node.name === 'root' || node.name === '_folded_section')) {
        const found = firstTarget(Array.isArray(node.content) ? node.content : node.content ? [node.content] : [])
        if (found) return found
        continue
      }
      if (node.type !== 'block' || isSetTransparent(node)) continue
      return node
    }
    return undefined
  }
  // A selection keeps no mark of an include that failed inside the files it ran
  // over; which comes first there, the target or a failure, is read off the
  // files themselves, in document order. Without a target, any failure counts.
  const failedBefore = (roots: any[], target: any): Held[] | undefined => {
    let found: Held[] | undefined
    let done = false
    const visit = (node: any): void => {
      if (done || !node || typeof node !== 'object') return
      if (Array.isArray(node)) return node.forEach(visit)
      const failed = failedAt.get(node)
      if (failed) {
        found = failed
        done = true
        return
      }
      if (node === target) {
        done = true
        return
      }
      visit(node.content)
    }
    roots.forEach(visit)
    return found
  }
  // For a block placed as its file reads on its own the order is read off that
  // reading, and the failure named is the first of the files as placed.
  const stoppedBefore = (roots: any[], target: any): Held[] | undefined => {
    const alone = target ? readAlone.get(target) : undefined
    if (!alone) return failedBefore(roots, target)
    return failedBefore(alone.roots, alone.node) ? failedBefore(roots, undefined) : undefined
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
  // the message a problem had before assignments were named in it, and the
  // names, so that a second loss joins the first
  const lost = new WeakMap<IncludeProblem, { message: string; set: ConfigItem[] }>()
  const lose = (entries: Held[], set: ConfigItem[]): void => {
    const final = entries[entries.length - 1].problem
    const before = lost.get(final) ?? { message: final.message, set: [] }
    const all = mergeSet(before.set, set)
    lost.set(final, { message: before.message, set: all })
    final.message = `${before.message}; =set assignments not applied: ${names(all)}`
    final.lost = all.map(c => c.name)
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
    const known = origin.get(node)
    if (known) origin.set(rest, known)
    opts.onCopy?.(node, rest)
    return rest
  }

  // `home` is the file a directive is written in: an operand of a selector
  // without a source, or with data:, reads from it. The =set assignments before
  // an include go to the first block it brings; when it brings none they go on
  // to the next block of the same list, and when it fails they go nowhere and
  // the failure says so.
  const walkList = (
    list: any[],
    context: unknown,
    stack: string[],
    chain: IncludeStep[],
    file: string,
    home: any,
    config: ConfigScope,
  ): any[] => {
    const out: any[] = []
    let pending: ConfigItem[] = []
    let last: { chain: IncludeStep[]; selector: string } | undefined
    const visit = (n: any): void => {
      if (n && n.type === 'config' && typeof n.name === 'string' && Array.isArray(n.config)) {
        config[n.name] = mergeConfigSettings(n.config, config[n.name])
      }
      if (isIncludeBlock(n)) {
        // assignments carried from an earlier include are older than its own
        const set = mergeSet(pending, n.set)
        pending = []
        const here = [...chain, { file, location: n.location }]
        let resolved: ReturnType<typeof resolveInclude>
        const at = reached.length
        try {
          resolved = resolveInclude(n, context, stack, here, file, home, config)
        } catch (e) {
          // the walk stops at an error with no handler; the assignments lost
          // on the way out are named in it as well
          const held = e && typeof e === 'object' ? thrownFrom.get(e) : undefined
          if (held && set.length && !reached[at]) {
            const error = e as Error
            const before = error.message
            // the stack is made from the message when first read
            const stack = error.stack
            lose([held], set)
            error.message = held.problem.message
            if (typeof stack === 'string') error.stack = stack.replace(before, () => error.message)
          }
          throw e
        } finally {
          reached.length = at
        }
        if (resolved.waiting) {
          const kept = set.length ? { ...n, set } : n
          const known = origin.get(n)
          if (kept !== n && known) origin.set(kept, known)
          out.push(kept)
          return
        }
        const { nodes, failure, inner, roots, selector } = resolved
        if (!failure) brought++
        if (!failure) markVia(nodes, `${file}@${n.location?.start?.offset ?? ''}`)
        if (failure) {
          const entries = failure.map(problem => ({ problem, shown: problem.kind !== 'cycle' }))
          if (set.length) lose(entries, set)
          hold(entries)
          failures.push(entries)
          const stops = nodes.length ? nodes : [{ type: FAILED }]
          stops.forEach(stop => failedAt.set(stop, entries))
          out.push(...stops)
          return
        }
        if (!set.length) {
          out.push(...nodes)
          return
        }
        // an include inside that failed before the target stops the search
        const stopped = roots ? stoppedBefore(roots, firstTarget(nodes)) : firstStop(nodes)
        if (stopped) {
          lose(stopped, set)
          out.push(...nodes)
          return
        }
        const applied = applySetToFirst(nodes, set, { mode: 'include', origin, onCopy: opts.onCopy })
        out.push(...applied.nodes)
        if (applied.outcome !== 'none') return
        // nothing came in because an include inside failed: what it would
        // have brought is not known, and the assignments go nowhere
        if (inner.length) {
          lose(inner[inner.length - 1], set)
          return
        }
        pending = set
        last = { chain: here, selector }
        return
      }
      const walked = walkNode(n, context, stack, chain, file, home, config)
      const items = Array.isArray(walked) ? walked : [walked]
      if (!pending.length) {
        out.push(...items)
        return
      }
      const stopped = firstStop(items)
      if (stopped) {
        lose(stopped, pending)
        pending = []
        out.push(...items)
        return
      }
      const applied = applySetToFirst(items, pending, { mode: 'carry', origin, onCopy: opts.onCopy })
      if (applied.outcome !== 'none') pending = []
      out.push(...applied.nodes)
    }
    level++
    try {
      for (const n of list) {
        visit(n)
        if (level === 1) flush()
      }
    } finally {
      level--
    }
    if (pending.length && last) {
      report({
        kind: 'set-target',
        target: last.selector,
        message: `=set before =include has no target block in scope: ${names(pending)}`,
        lost: pending.map(c => c.name),
        chain: last.chain,
      })
    }
    return out
  }

  // The directive a block came through is kept with its origin, so that the
  // two readings of a file name the same block the same way.
  const markVia = (nodes: any[], step: string): void => {
    const visit = (node: any): void => {
      if (!node || typeof node !== 'object') return
      if (Array.isArray(node)) return node.forEach(visit)
      const known = origin.get(node)
      if (known) origin.set(node, { ...known, via: known.via ? `${step}>${known.via}` : step })
      visit(node.content)
    }
    visit(nodes)
  }

  const isFolded = (node: any): boolean =>
    node && typeof node === 'object' && node.type === 'block' && node.name === '_folded_section'
  // a folded section is put around written blocks; they are counted as if it were not there
  const childrenOf = (node: any): any[] => {
    const list = Array.isArray(node.content) ? node.content : node.content ? [node.content] : []
    return list.flatMap((child: any) => (isFolded(child) ? childrenOf(child) : [child]))
  }
  // A block written in a file is named by the directives it came through and
  // its place in that file. A node the reading adds has no place of its own, and
  // a block of a Markdown section counts its place from the section: both are
  // named by the nearest written block above and the way down from it.
  const namesOf = (root: any): Array<[object, string]> => {
    const out: Array<[object, string]> = []
    const visit = (node: any, above: string, step: string, counted: boolean): void => {
      if (!node || typeof node !== 'object') return
      const where = origin.get(node)
      const offset = node.location?.start?.offset
      const name =
        !counted && where && typeof offset === 'number'
          ? `${where.via ?? ''}|${where.file}|${offset}|${node.type}|${node.name ?? ''}`
          : `${above}/${step}|${node.type}|${node.name ?? ''}`
      out.push([node, name])
      const section = node.type === 'block' && (node.name === 'markdown' || node.name === 'Markdown')
      childrenOf(node).forEach((child, i) => visit(child, name, String(i), counted || section))
    }
    visit(root, '', 'root', false)
    return out
  }

  const copyDeep = (node: any): any => {
    if (Array.isArray(node)) return node.map(copyDeep)
    if (!node || typeof node !== 'object') return node
    const copy: any = {}
    for (const key of Object.keys(node)) copy[key] = key === 'location' ? node[key] : copyDeep(node[key])
    const known = origin.get(node)
    if (known) origin.set(copy, known)
    opts.onCopy?.(node, copy)
    return copy
  }

  // A block placed as its file reads on its own, and where it was found: the
  // files read with the settings at the directive do not hold it.
  const readAlone = new WeakMap<object, { node: object; roots: any[] }>()

  const isToc = (node: any): boolean =>
    node && typeof node === 'object' && node.type === 'block' && (node.name === 'toc' || node.name === 'Toc')
  // A table of contents is built while its file is parsed, before the includes
  // of that file are in. The tables written in an included file are built again
  // over it once they are; those an include of its own brought were built over
  // their own file already.
  const finishFile = (root: any, file: string): any => {
    markGuarded(root)
    // a table that cannot be built said so when its file was read
    const rebuilt = (node: any): any => silently(() => rebuildToc(node, root))
    const walk = (node: any): any => {
      if (!node || typeof node !== 'object') return node
      if (Array.isArray(node)) {
        const mapped = node.map(walk)
        return mapped.some((n, i) => n !== node[i]) ? mapped : node
      }
      const where = origin.get(node)
      const made = isToc(node) && where?.file === file && !where.via ? rebuilt(node) : node
      const content = made === node && Array.isArray(node.content) ? walk(node.content) : node.content
      if (made === node && content === node.content) return node
      const copy = made === node ? { ...node, content } : made
      if (where) origin.set(copy, where)
      opts.onCopy?.(node, copy)
      return copy
    }
    return walk(root)
  }

  // A file as it reads on its own, its includes in. It is the same wherever it
  // is included from, apart from the files already on the way.
  const sources = new Map<string, any>()
  const sourceOf = (target: string, text: string, dir: unknown, stack: string[], here: IncludeStep[]): any => {
    const key = stack.join('\n')
    const known = sources.get(key)
    if (known) return known
    const own = silently(() => opts.parse(text, target))
    recordOrigin(own, { file: target, text }, origin)
    const failed = failures.length
    const from = reachedFrom
    quiet++
    reachedFrom = reached.length
    try {
      const before = brought
      const walked = asDocument(walkNode(own, dir, stack, here, target, own, {}))
      const tree = brought > before ? finishFile(walked, target) : walked
      sources.set(key, tree)
      return tree
    } finally {
      quiet--
      reachedFrom = from
      failures.length = failed
    }
  }

  // What an include comes to: the nodes that take its place, or the problems
  // that left it with nothing, not yet reported
  const resolveInclude = (
    node: any,
    context: unknown,
    stack: string[],
    here: IncludeStep[],
    file: string,
    home: any,
    config: ConfigScope,
  ): {
    nodes: any[]
    failure?: IncludeProblem[]
    inner: Held[][]
    roots?: any[]
    selector: string
    // a source of the include is not known yet
    waiting?: boolean
  } => {
    const mark = failures.length
    reached.push(false)
    // the walked files a selection ran over, in order
    let roots: any[] | undefined
    const done = (nodes: any[], failure?: IncludeProblem[]) => ({
      nodes,
      failure,
      inner: failures.slice(mark),
      roots,
      selector,
    })
    const selector = getTextContentFromNode(node.content)?.toString().trim() ?? ''
    const parsed = selector ? parseSelector(selector) : undefined
    if (parsed?.anchor) reached[reached.length - 1] = true
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

    const wait = () => ({ nodes: [node], inner: failures.slice(mark), roots: undefined, selector, waiting: true })
    const located = provider.locate(parsed.document, context, false, here[here.length - 1])
    if (!located) return wait()
    if (located.failed !== undefined) {
      return fail({
        kind: 'source',
        target: selector,
        message: `include mask cannot be expanded: ${parsed.document}: ${located.failed}`,
        chain: here,
      })
    }
    const { masked, sources: written } = located
    const first = !masked && written.length ? textOf(written[0]) : null
    if (first === undefined) return wait()
    if (!masked && first === null) {
      return fail({
        kind: 'source',
        target: selector,
        message: `include target not found: ${parsed.document}`,
        chain: here,
      })
    }

    // With settings in effect at the directive a file is read twice: with them,
    // for the blocks that take its place, and on its own, for the selection.
    const scoped = Object.keys(config).length > 0
    const docs: Array<{ file: string; node: any }> = []
    const placedDocs: any[] = []
    const unread: IncludeProblem[] = []
    let cyclic = false
    let waiting = false
    for (const source of written) {
      const { id: target, name } = source
      if (stack.includes(target)) {
        cyclic = true
        continue
      }
      const text = textOf(source)
      if (text === undefined) {
        waiting = true
        continue
      }
      if (text === null) {
        unread.push({
          kind: 'source',
          target: selector,
          message: `include target cannot be read: ${name}`,
          chain: here,
        })
        continue
      }
      // read on its own first: a text that fails this reading brings nothing, and
      // what its includes would have said is not said
      let alone: any
      if (scoped) {
        try {
          alone = sourceOf(target, text, source.context, [...stack, target], here)
        } catch (e) {
          if (!opts.tolerant) throw e
          unread.push({
            kind: 'source',
            target: selector,
            message: `include target cannot be read: ${name}: ${(e as Error)?.message ?? e}`,
            chain: here,
          })
          continue
        }
      }
      let own: any
      try {
        own = opts.parse(text, target, scoped ? config : undefined)
      } catch (e) {
        if (!opts.tolerant) throw e
        unread.push({
          kind: 'source',
          target: selector,
          message: `include target cannot be read: ${name}: ${(e as Error)?.message ?? e}`,
          chain: here,
        })
        continue
      }
      recordOrigin(own, { file: target, text }, origin)
      const dir = source.context
      const before = brought
      const walked = asDocument(walkNode(own, dir, [...stack, target], here, target, own, { ...config }))
      const placed = brought > before ? finishFile(walked, target) : walked
      placedDocs.push(placed)
      docs.push({ file: name, node: alone ?? placed })
    }
    if (waiting) return wait()
    // The blocks found in the files as they read on their own are placed as the
    // same files read them at the directive.
    const placedFor = (found: any[]): any[] => {
      if (!scoped) return found
      const pairs = docs.map((doc, i) => ({
        source: new Map(namesOf(doc.node)),
        placed: new Map(
          namesOf(placedDocs[i])
            .map(([node, name]): [string, object] => [name, node])
            .reverse(),
        ),
      }))
      let differs = false
      const out = found.map(node => {
        for (const pair of pairs) {
          const name = pair.source.get(node)
          if (name === undefined) continue
          const twin = pair.placed.get(name)
          if (twin) return twin
          differs = true
          const copy = propagateConfigDefaults([copyDeep(node)], config)[0]
          readAlone.set(copy, { node, roots: docs.map(doc => doc.node) })
          return copy
        }
        return node
      })
      if (differs) {
        report({
          kind: 'include-reading-differs',
          target: selector,
          message: `include places a block as its file reads on its own; the settings at the directive read it differently: ${selector}`,
          chain: here,
        })
      }
      return out
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
      if (found.length > 0) return done(placedFor(found))
      return fail({
        kind: 'address',
        target: selector,
        message: `include address not found: #${parsed.anchor} in ${parsed.document}`,
        chain: here,
      })
    }

    roots = placedDocs

    // a file an operand names is read the way an included file is, from the
    // directory of the directive; one already on the way does not resolve
    let operandWaits = false
    const readFile = (document: string): SelectorDoc[] | undefined => {
      const found = provider.locate(document, context, true)
      const source = found?.sources[0]
      const target = source?.id ?? ''
      const text = !source || stack.includes(target) ? null : textOf(source)
      if (!found || text === undefined) operandWaits = true
      if (!source || text === null || text === undefined) return undefined
      let own: any
      try {
        own = opts.parse(text, target)
      } catch (e) {
        // a file that fails to parse is one the operand cannot be read from
        if (!opts.tolerant) throw e
        return undefined
      }
      recordOrigin(own, { file: target, text }, origin)
      return [
        {
          file: document,
          node: asDocument(walkNode(own, source.context, [...stack, target], here, target, own, {})),
        },
      ]
    }
    try {
      const found = outermost(
        keepBlocks(runSelector(selector, docs, { home: [{ file, node: asDocument(home) }], readFile })),
      )
      if (operandWaits) return wait()
      return done(placedFor(found))
    } catch (e) {
      if (!(e instanceof SelectorError)) throw e
      if (operandWaits) return wait()
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
    context: unknown,
    stack: string[],
    chain: IncludeStep[],
    file: string,
    home: any,
    config: ConfigScope,
  ): any => {
    if (!node || typeof node !== 'object') return node
    if (Array.isArray(node)) return walkList(node, context, stack, chain, file, home, config)
    if (isIncludeBlock(node)) return walkList([node], context, stack, chain, file, home, config)
    const wrapper = node.type === 'block' && (node.name === 'root' || node.name === '_folded_section')
    if (node.type === 'block' && !wrapper && !isSetTransparent(node)) {
      markReached()
    }

    if (Array.isArray(node.content)) {
      // a block is a lexical scope for the settings declared inside it
      const scope = node.type === 'block' && !wrapper ? { ...config } : config
      const copy = { ...node, content: walkList(node.content, context, stack, chain, file, home, scope) }
      const known = origin.get(node)
      if (known) origin.set(copy, known)
      opts.onCopy?.(node, copy)
      return copy
    }
    return node
  }

  try {
    return unmark(walkNode(tree, opts.context, opts.self ? [opts.self] : [], [], mainFile, tree, {}))
  } finally {
    flush()
  }
}

export { sourcesFromFiles } from './files'
export { assembleAsync, createSourceStore } from './async'
export type { AsyncSources, SourceStore, AssembleAsyncOptions } from './async'
