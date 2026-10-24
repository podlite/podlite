import {
  applySetToFirst,
  holderInside,
  isDirectiveNode,
  isSetTarget,
  isSetTransparent,
  markGuarded,
  bindTarget,
  ConfigItem,
  ConfigScope,
  mergeConfigSettings,
  propagateConfigDefaults,
  buildBindingIndex,
  getTextContentFromNode,
  isWrapper,
  Location,
  mergeSet,
  outermost,
  ParseDiagnostic,
  ParsedSelector,
  readSelector,
  podlitePluggable,
  runSelector,
  SelectorDoc,
  PodNode,
  SelectorError,
} from '@podlite/schema'
import { rebuildToc } from '@podlite/toc'
import { formatOfFile, formatOfType } from '../file-format'
import type { ReadFormat } from '../file-format'

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
    // blocks of a source the provider calls external stand in the document
    | 'external'
    // the directive declares a type there is no reader for
    | 'format'
    // a selection over a source holding an include that waits for a later pass
    | 'incomplete-selection'
  target: string
  message: string
  // the =set assignments the problem lost, by name
  lost?: string[]
  // the first step is the directive in the document itself, the last one the
  // directive the problem was found at
  chain: IncludeStep[]
  // for external: the sources whose blocks stand in the result
  sources?: Source[]
}

export type IncludeOrigin = {
  file: string
  text: string
  // the directives the node came through inside the file it was read with
  via?: string
  // the same directives, outermost first, by file and place
  steps?: IncludeStep[]
}

/*
=begin pod :kind<export>

=head2 Source

A text an C<=include> can bring. C<id> is its identity: two sources are the same
text when their ids are equal, and a source already on the way in is a cycle.
One id stands for one place: the same text, with paths inside it resolved from
the same place. The same text held in two places is two sources.
C<format>, when the provider gives it, is the format the text is read in; without
it the format is told from the id. A C<:mime-type> written on the directive
line after the address of the source overrides both for that one reading, so
one source may be read in two formats by two directives.
C<name> is what a C<file:> selector matches the source by and what messages show; a
C<doc:> selector matches the names written in the text.
C<context> is what paths written inside the source are resolved from; only the
provider reads it.
C<external>, when the provider gives it, says the source is external and why, as
the words that follow "comes from": C<outside the root /home/a/book>. A directive
whose blocks of an external source stand in the assembled document is reported
once as C<external>. A block counts where a renderer leaves it out, as a comment:
it stands in the document. A table of contents built over such blocks is not: its
entries are made anew and carry no origin. Directives are told apart by their
place, so in a tree built without places two directives of one file count as one.

=end pod
*/
export type Source = {
  id: string
  name: string
  context: unknown
  format?: ReadFormat
  external?: string
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

C<schemes> names the address schemes the provider resolves, C<file> alone when
not given; the list is complete, and an include of another scheme is reported as
unsupported without asking, while an operand of another scheme is looked for among
the documents at hand. The scheme comes as the last argument of C<locate>.
For C<doc:> the path is the name of a document: the text or the C<:id> of a
C<=NAME> or C<=TITLE> block written in it, at any depth; a block its includes
bring gives it no name. A path that is not a mask names one source. A provider
that finds more than one, or none it can give, says why in C<failed>; it does not
throw. For the document to be caught including itself, C<self> is the id the
provider gives it.

=end pod
*/
// `failed` says why the path could not be resolved
export type Located = { masked: boolean; sources: Source[]; failed?: string }

export type Sources = {
  schemes?: readonly string[]
  // `at` is the directive the path is written in, when it is an include
  locate: (path: string, context: unknown, plain?: boolean, at?: IncludeStep, scheme?: string) => Located | undefined
  read: (source: Source) => string | null | undefined
}

export type AssembleOptions = {
  sources: Sources
  // what the paths written in the document itself are resolved from
  context: unknown
  // `config` holds the settings in effect at the directive that places the text
  // `how.format` is the format the text is read in
  parse: (source: string, file: string, config?: ConfigScope, how?: { format?: ReadFormat }) => any
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
  // a path that names a source already on the way in is reported even when it loses no =set
  reportCycles?: boolean
  // only the includes with no source are resolved; the others stay as written,
  // and nothing is said of them: for a host that has no files to give
  onlySameDocument?: boolean
}

export const isWarning = (problem: IncludeProblem): boolean =>
  problem.kind === 'ambiguous' ||
  problem.kind === 'unparsed-selector' ||
  problem.kind === 'unsupported-scheme' ||
  problem.kind === 'cycle' ||
  problem.kind === 'set-target' ||
  problem.kind === 'include-reading-differs' ||
  problem.kind === 'external' ||
  problem.kind === 'incomplete-selection'

// The configuration as the parser reads it on a block, when it reads the text
// whole: no value is dropped and nothing spills into the body.
let configParser: ReturnType<typeof podlitePluggable> | undefined
const readWhole = (tail: string): ConfigItem[] | undefined => {
  configParser = configParser ?? podlitePluggable()
  const diagnostics: ParseDiagnostic[] = []
  const tree: any = configParser.parse(`=for para ${tail}\nbody\n`, { podMode: 1, diagnostics })
  const block = (tree.content ?? []).find((node: any) => node && node.type === 'block')
  if (diagnostics.length || !block || !Array.isArray(block.config) || block.config.length === 0) return undefined
  return String(getTextContentFromNode(block.content)).trim() === 'body' ? block.config : undefined
}

// The line of a directive holds the selector and, after the address of the
// source, its configuration: it begins at the first white space followed by a
// colon before the selection, and ends at the last bar before which it reads
// whole, or at the end of the line. A configuration that does not
// read whole leaves the line unread.
// whether a bar stands outside the brackets of a predicate: a bar inside one
// belongs to an operand, not to the selector
const hasTopLevelBar = (line: string): boolean => {
  let depth = 0
  let angle = 0
  let quote = ''
  for (const c of line) {
    // a value in quotes or angles is read whole, whatever brackets it holds
    if (quote) {
      if (c === quote) quote = ''
    } else if (angle) {
      if (c === '<' || c === '«') angle++
      else if (c === '>' || c === '»') angle--
    } else if (c === "'" || c === '"') quote = c
    else if (c === '<' || c === '«') angle++
    else if (c === '[' || c === '(') depth++
    else if ((c === ']' || c === ')') && depth > 0) depth--
    else if (c === '|' && depth === 0) return true
  }
  return false
}

const splitDirective = (line: string): { selector: string; mimeType?: string; unread?: boolean } => {
  // without the address of a source there is no place for a configuration: a
  // source is written with its scheme, or without one when a selection follows
  if (!/^[a-z][\w+.-]*:/i.test(line) && !hasTopLevelBar(line)) return { selector: line }
  let start = -1
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '|') break
    if (/\s/.test(line[i]) && line[i + 1] === ':') {
      start = i
      break
    }
  }
  if (start === -1) return { selector: line }
  const ends: number[] = []
  for (let i = start; i < line.length; i++) if (line[i] === '|') ends.push(i)
  ends.push(line.length)
  // the longest one that reads whole: a bar or a quote inside a value can make a
  // shorter one read whole too
  for (const end of ends.reverse()) {
    const items = readWhole(line.slice(start, end).trim())
    if (!items) continue
    const rest = line.slice(end).trim()
    const selector = rest ? `${line.slice(0, start).trim()} ${rest}` : line.slice(0, start).trim()
    const types = items.filter(item => item.name === 'mime-type')
    if (types.length > 1) return { selector, unread: true }
    return { selector, mimeType: types.length ? String(types[0].value) : undefined }
  }
  return { selector: line, unread: true }
}

/*
=begin pod :kind<export>

=head2 externalMessage

The text of an C<external> warning: the external sources an include brought, by
count and reason, and the path as the directive writes it. A host that shows part
of a document gives it the sources whose blocks it shows.

=end pod
*/
export const externalMessage = (sources: Source[], written: string): string => {
  const reasons = new Map<string, number>()
  for (const source of sources) {
    const reason = source.external ?? ''
    reasons.set(reason, (reasons.get(reason) ?? 0) + 1)
  }
  const total = sources.length
  if (reasons.size === 1) {
    const [reason] = [...reasons.keys()]
    return total === 1
      ? `included file comes from ${reason}: ${written}`
      : `${total} included files come from ${reason}: ${written}`
  }
  const parts = [...reasons].map(([reason, count]) => `${count} ${count === 1 ? 'comes' : 'come'} from ${reason}`)
  return `${total} included files: ${parts.join(', ')}: ${written}`
}

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

/*
=begin pod :kind<export>

=head2 hasSameDocumentInclude

Whether a tree holds an C<=include> with no source, one that selects from the
document itself. Such an include needs no file to resolve, so a host that has no
files to give can still assemble the tree with C<onlySameDocument>.

=end pod
*/
export const hasSameDocumentInclude = (tree: any): boolean => {
  const work = [tree]
  while (work.length) {
    const node = work.pop()
    if (!node || typeof node !== 'object') continue
    if (Array.isArray(node)) {
      for (const item of node) work.push(item)
      continue
    }
    if (isIncludeBlock(node)) {
      const line = getTextContentFromNode(node.content)?.toString().trim() ?? ''
      const { selector, unread } = splitDirective(line)
      if (!selector || unread) continue
      try {
        const parsed = readSelector(selector)
        if (!parsed.scheme && !parsed.document && !parsed.anchor && parsed.patterns.length > 0) return true
      } catch (e) {
        if (!(e instanceof SelectorError)) throw e
      }
      continue
    }
    if (node.content) work.push(node.content)
  }
  return false
}

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

  const schemes = provider.schemes ?? ['file']
  // why a path gives no source to read: the provider said so, or it named more than one
  const refusal = (located: Located): string | undefined => {
    if (located.failed !== undefined) return located.failed
    if (located.masked) return undefined
    const places = new Map(located.sources.map((source): [string, Source] => [source.id, source]))
    if (places.size < 2) return undefined
    return `more than one source answers: ${[...places.values()].map(s => `${s.name} (${s.id})`).join(', ')}`
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
  // An include that read external sources waits for the walk of its entry: it is
  // reported only if blocks it brought from them stand in the result.
  type Outside = { step: string; written: string; sources: Source[] }
  // A slot is held where an include with no source stands in the first walk: the
  // problems the second walk finds for it are put there, in the order of the document.
  type Held = { problem: IncludeProblem; shown: boolean; outside?: Outside; slot?: true }
  const held: Held[] = []
  // the slot of the include with no source the second walk is resolving, outermost first
  const slots: Held[] = []
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
    const slot = slots[0]
    const at = slot ? held.indexOf(slot) : -1
    if (at >= 0) held.splice(at, 0, ...entries)
    else held.push(...entries)
  }
  const report = (problem: IncludeProblem): void => hold([{ problem, shown: true }])
  const flush = (): void => {
    held
      .splice(0)
      .filter(entry => entry.shown && !entry.slot)
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
  // An include left to wait for a later pass carries this mark on itself, so a
  // copy of it, wherever it is made, waits as well. The mark is this call's own:
  // a later pass does not read it.
  const WAITING = Symbol('waiting include')
  // An include with no source selects from the document in one state: its includes
  // of other sources in, its own includes with no source as written (Specification,
  // Include directive). The first walk leaves each such include in place with this
  // mark, which carries the place it stands in; when the walk is over, a second walk
  // over its result resolves the marked includes from that result, which they are not
  // in, so none of them sees what another one brought. Its copies are walked by that
  // second walk too, and a block is not placed inside itself: the blocks the walk is
  // inside, read back to the blocks of that result they are copies of, are the path a
  // block found must not be on.
  const PLACEMENT = Symbol('include with no source')
  type Placement = { file: string; here: IncludeStep[]; context: unknown; slot?: any }
  let placements = 0
  let secondWalk = false
  // the result of the first walk, which the marked includes select from
  let state: any
  // something in the first walk waited for a source: the state is not known in full
  let stateWaits = false
  // the block of the state a block of the second walk is, or is a copy of
  const placedFrom = new WeakMap<object, object>()
  const inside: object[] = []
  // In the second walk an include with no source inside a wrapper may bring nothing:
  // the assignments it held go on past the wrapper, to the next block of the list
  // that holds it, as they would have had it been resolved in the first walk. They
  // pass only out of the wrappers the tree adds (root, _folded_section), never out of
  // a written block, and not out of the root of the document, where they are reported.
  let escapeNext = false
  let escaped: { pending: ConfigItem[]; last?: { chain: IncludeStep[]; selector: string } } | undefined
  // a cycle of an include with no source is reported whether or not it loses =set
  const alwaysShown = new WeakSet<IncludeProblem>()
  const FAILED = 'include-failed'
  const isMark = (node: any): boolean => node && typeof node === 'object' && node.type === FAILED
  const firstStop = (nodes: any[], holder: any): Held[] | undefined => {
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue
      const failed = failedAt.get(node)
      if (failed) return failed
      if (node.type === 'block' && (node.name === 'root' || node.name === '_folded_section')) {
        const inner = Array.isArray(node.content) ? node.content : node.content ? [node.content] : []
        const within = holderInside(node, holder)
        const found = firstStop(inner, within)
        if (found !== undefined) return found
        if (inner.some((n: any) => isSetTarget(n, within))) return undefined
        continue
      }
      if (!isSetTarget(node, holder)) continue
      return undefined
    }
    return undefined
  }
  // The block the assignments would go to, before any is given: the first that
  // is not transparent, looking inside the wrappers the tree adds.
  const firstTarget = (nodes: any[], holder: any): any => {
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue
      if (failedAt.has(node)) return node
      if (node.type === 'block' && (node.name === 'root' || node.name === '_folded_section')) {
        const inner = Array.isArray(node.content) ? node.content : node.content ? [node.content] : []
        const found = firstTarget(inner, holderInside(node, holder))
        if (found) return found
        continue
      }
      if (!isSetTarget(node, holder)) continue
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
  // a mask that finds the file it is written in passes it by, and says so only when =set is lost
  const maskCycles = new WeakSet<IncludeProblem>()
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
  // without a source, or with data:, reads from it. `holder` is the block the
  // list is the content of; none means the document. The =set assignments before
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
    holder?: any,
  ): any[] => {
    const out: any[] = []
    let pending: ConfigItem[] = []
    let last: { chain: IncludeStep[]; selector: string } | undefined
    const mayEscape = escapeNext
    escapeNext = false
    // what an include with no source says in the second walk goes to its slot
    const visit = (n: any): void => {
      const slot = secondWalk && isIncludeBlock(n) && !slots.length ? n[PLACEMENT]?.slot : undefined
      if (slot) slots.push(slot)
      try {
        visitEntry(n)
      } finally {
        if (slot) slots.pop()
      }
    }
    const visitEntry = (n: any): void => {
      if (n && n.type === 'config' && typeof n.name === 'string' && Array.isArray(n.config)) {
        config[n.name] = mergeConfigSettings(n.config, config[n.name])
      }
      if (isIncludeBlock(n) && (!secondWalk || n[PLACEMENT])) {
        // assignments carried from an earlier include are older than its own
        const set = mergeSet(pending, n.set)
        pending = []
        // an include with no source names the place it was written in
        const placed: Placement | undefined = secondWalk ? n[PLACEMENT] : undefined
        const here = placed ? placed.here : [...chain, { file, location: n.location }]
        const where = placed ? placed.file : file
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
        if (resolved.kept) {
          // as written, with the assignments it would have taken
          const kept = set.length ? { ...n, set } : n
          if (kept !== n) {
            const known = origin.get(n)
            if (known) origin.set(kept, known)
            opts.onCopy?.(n, kept)
          }
          out.push(kept)
          return
        }
        if (resolved.placement) {
          // left for the second walk with its assignments, as the place it stands in
          placements++
          const slot = { problem: undefined, shown: false, slot: true }
          if (!quiet) held.push(slot as any)
          const kept = { ...n, ...(set.length ? { set } : {}), [PLACEMENT]: { ...resolved.placement, slot } }
          const known = origin.get(n)
          if (known) origin.set(kept, known)
          opts.onCopy?.(n, kept)
          out.push(kept)
          return
        }
        if (resolved.waiting) {
          const kept = { ...n, ...(set.length ? { set } : {}), [WAITING]: true }
          const known = origin.get(n)
          if (known) origin.set(kept, known)
          opts.onCopy?.(n, kept)
          out.push(kept)
          return
        }
        const { nodes, failure, inner, roots, selector } = resolved
        if (!failure) brought++
        if (!failure)
          markVia(nodes, `${where}@${n.location?.start?.offset ?? ''}`, { file: where, location: n.location })
        // a copy an include with no source placed came first through the way that include came
        if (!failure && placed) {
          const way = origin.get(n)
          if (way?.via) prefixVia(nodes, way)
        }
        if (!failure && resolved.outside.length) {
          const step = stepOf(where, n.location)
          const problem: IncludeProblem = { kind: 'external', target: selector, message: '', chain: here }
          hold([{ problem, shown: false, outside: { step, written: resolved.written, sources: resolved.outside } }])
        }
        if (failure) {
          const entries = failure.map(problem => ({
            problem,
            shown:
              problem.kind !== 'cycle' ||
              alwaysShown.has(problem) ||
              (opts.reportCycles === true && !maskCycles.has(problem)),
          }))
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
        const stopped = roots ? stoppedBefore(roots, firstTarget(nodes, holder)) : firstStop(nodes, holder)
        if (stopped) {
          lose(stopped, set)
          out.push(...nodes)
          return
        }
        const applied = applySetToFirst(nodes, set, { mode: 'include', origin, onCopy: copied, holder })
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
      const walked = walkNode(n, context, stack, chain, file, home, config, holder)
      const leaving = escaped
      escaped = undefined
      const items = Array.isArray(walked) ? walked : [walked]
      const goOn = (): void => {
        if (!leaving) return
        pending = mergeSet(pending, leaving.pending)
        last = leaving.last ?? last
      }
      if (!pending.length) {
        out.push(...items)
        return goOn()
      }
      const stopped = firstStop(items, holder)
      if (stopped) {
        lose(stopped, pending)
        pending = []
        out.push(...items)
        return goOn()
      }
      const applied = applySetToFirst(items, pending, { mode: 'carry', origin, onCopy: copied, holder })
      if (applied.outcome !== 'none') pending = []
      out.push(...applied.nodes)
      goOn()
    }
    level++
    try {
      for (const n of list) {
        const from = out.length
        visit(n)
        // the problems wait for the end of the call: the second walk may yet name
        // assignments a failure of the first one lost
        if (level === 1) confirmOutside(out.slice(from))
      }
    } finally {
      level--
    }
    if (pending.length && mayEscape) {
      escaped = { pending, last }
      return out
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
  const markVia = (nodes: any[], step: string, at: IncludeStep): void => {
    const visit = (node: any): void => {
      if (!node || typeof node !== 'object') return
      if (Array.isArray(node)) return node.forEach(visit)
      const known = origin.get(node)
      if (known) {
        const via = known.via ? `${step}>${known.via}` : step
        origin.set(node, { ...known, via, steps: [at, ...(known.steps ?? [])] })
      }
      visit(node.content)
    }
    visit(nodes)
  }

  // The way a placement came, put before the way of each node it brought.
  const prefixVia = (nodes: any[], way: IncludeOrigin): void => {
    const visit = (node: any): void => {
      if (!node || typeof node !== 'object') return
      if (Array.isArray(node)) return node.forEach(visit)
      const known = origin.get(node)
      if (known) {
        const via = known.via ? `${way.via}>${known.via}` : way.via
        origin.set(node, { ...known, via, steps: [...(way.steps ?? []), ...(known.steps ?? [])] })
      }
      visit(node.content)
    }
    visit(nodes)
  }

  // Which directive of which entry: the file it is written in, as the walk names
  // it, and its offset there.
  const stepOf = (file: string, location?: Location): string => `${file}\u0000${location?.start?.offset ?? ''}`
  const said = new Map<string, IncludeProblem>()
  // The external sources whose blocks stand in what an entry of the document's
  // own list became confirm the includes that brought them.
  const confirmOutside = (nodes: any[]): void => {
    const waiting = held.filter(entry => entry.outside && !entry.shown)
    if (waiting.length === 0) return
    const placed = new Map<string, Set<string>>()
    const visit = (node: any): void => {
      if (!node || typeof node !== 'object') return
      if (Array.isArray(node)) return node.forEach(visit)
      // what a directive or a failed include holds stands nowhere; a comment does
      const comment = node.type === 'block' && node.name === 'comment'
      if ((isSetTransparent(node) && !comment) || isMark(node)) return
      const where = origin.get(node)
      const wrapper = node.type === 'block' && (node.name === 'root' || node.name === '_folded_section')
      if (where && !wrapper) {
        for (const at of where.steps ?? []) {
          const step = stepOf(at.file, at.location)
          const files = placed.get(step) ?? new Set<string>()
          files.add(where.file)
          placed.set(step, files)
        }
      }
      visit(node.content)
    }
    visit(nodes)
    for (const entry of waiting) {
      if (!entry.outside) continue
      const { step, written, sources } = entry.outside
      const files = placed.get(step)
      const shown = sources.filter(
        (source, at) => files?.has(source.id) && sources.findIndex(other => other.id === source.id) === at,
      )
      if (shown.length === 0) continue
      const message = externalMessage(shown, written)
      const at = entry.problem.chain[entry.problem.chain.length - 1]
      const key = `${at?.file}\u0000${at?.location?.start?.offset ?? ''}\u0000${message}`
      // the same line again is not shown, but what it brought is kept with the first
      const first = said.get(key)
      if (first) {
        const known = first.sources ?? []
        first.sources = [...known, ...shown.filter(source => !known.some(other => other.id === source.id))]
        continue
      }
      said.set(key, entry.problem)
      entry.problem.message = message
      entry.problem.sources = shown
      entry.shown = true
    }
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
    if (node[WAITING]) copy[WAITING] = true
    if (node[PLACEMENT]) copy[PLACEMENT] = node[PLACEMENT]
    const known = origin.get(node)
    if (known) origin.set(copy, known)
    opts.onCopy?.(node, copy)
    return copy
  }

  // What a copy made inside this call keeps of the node it copies: where an include
  // failed, a reading on its own, the block of the state it stands for, the marks.
  const carry = (from: any, to: any): void => {
    const failed = failedAt.get(from)
    if (failed) failedAt.set(to, failed)
    const alone = readAlone.get(from)
    if (alone) readAlone.set(to, alone)
    const placed = placedFrom.get(from)
    if (placed) placedFrom.set(to, placed)
    if (from[WAITING]) to[WAITING] = true
    if (from[PLACEMENT]) to[PLACEMENT] = from[PLACEMENT]
  }
  const copied = (from: object, to: object): void => {
    carry(from, to)
    opts.onCopy?.(from, to)
  }

  // A block found in the state, copied for one place: each node remembers the node
  // of the state it copies, and a failure, a reading on its own and the marks it
  // carries come with it, so a copy is read as the block it copies.
  const copyPlaced = (node: any): any => {
    if (Array.isArray(node)) return node.map(copyPlaced)
    if (!node || typeof node !== 'object') return node
    const copy: any = {}
    for (const key of Object.keys(node)) copy[key] = key === 'location' ? node[key] : copyPlaced(node[key])
    if (node[WAITING]) copy[WAITING] = true
    if (node[PLACEMENT]) copy[PLACEMENT] = node[PLACEMENT]
    placedFrom.set(copy, placedFrom.get(node) ?? node)
    const failed = failedAt.get(node)
    if (failed) failedAt.set(copy, failed)
    const alone = readAlone.get(node)
    if (alone) readAlone.set(copy, alone)
    const known = origin.get(node)
    if (known) origin.set(copy, known)
    opts.onCopy?.(node, copy)
    return copy
  }

  // A block placed as its file reads on its own, and where it was found: the
  // files read with the settings at the directive do not hold it.
  const readAlone = new WeakMap<object, { node: object; roots: any[] }>()

  // An inclusion brings blocks: a directive that stands among them, outside
  // every block it brings, stays behind. Only the wrappers the tree adds are
  // walked; a block keeps what is written in it. An include that waits for a
  // later pass is not yet a directive left behind: it stays to be resolved.
  const withoutLooseDirectives = (nodes: any[]): any[] =>
    nodes.flatMap(node => {
      if (isDirectiveNode(node) && (node.name !== 'include' || failedAt.has(node))) return []
      if (!isWrapper(node) || !Array.isArray(node.content)) return [node]
      const content = withoutLooseDirectives(node.content)
      if (content.length === node.content.length && content.every((n, i) => n === node.content[i])) return [node]
      const copy = { ...node, content }
      const known = origin.get(node)
      if (known) origin.set(copy, known)
      const alone = readAlone.get(node)
      if (alone) readAlone.set(copy, alone)
      opts.onCopy?.(node, copy)
      return [copy]
    })

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
  const sourceOf = (
    target: string,
    text: string,
    dir: unknown,
    stack: string[],
    here: IncludeStep[],
    format: ReadFormat,
  ): any => {
    const key = `${stack.join('\n')}\u0000${format}`
    const known = sources.get(key)
    if (known) return known
    const own = silently(() => opts.parse(text, target, undefined, { format }))
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

  // A file an operand names is read the way an included file is, from the directory
  // of the directive; one already on the way does not resolve.
  const operandReader = (context: unknown, stack: string[], here: IncludeStep[]) => {
    let waits = false
    const read = (scheme: string, document: string): SelectorDoc[] | undefined => {
      if (!schemes.includes(scheme)) return undefined
      const found = provider.locate(document, context, true, undefined, scheme)
      const refused = found && refusal(found)
      if (refused !== undefined) {
        throw new SelectorError('resolution', `the source does not resolve: ${scheme}:${document}: ${refused}`)
      }
      const source = found?.sources[0]
      const target = source?.id ?? ''
      const text = !source || stack.includes(target) ? null : textOf(source)
      if (!found || text === undefined) waits = true
      if (!source || text === null || text === undefined) return undefined
      let own: any
      try {
        own = opts.parse(text, target, undefined, { format: source.format ?? formatOfFile(target) })
      } catch (e) {
        // a file that fails to parse is one the operand cannot be read from
        if (!opts.tolerant) throw e
        return undefined
      }
      recordOrigin(own, { file: target, text }, origin)
      // the file is a document of its own: it is walked as the first walk walks
      const second = secondWalk
      secondWalk = false
      try {
        return [
          {
            file: document,
            node: asDocument(walkNode(own, source.context, [...stack, target], here, target, own, {})),
          },
        ]
      } finally {
        secondWalk = second
      }
    }
    return { read, waits: () => waits }
  }

  // An include with no source, in the second walk: its blocks are found in the state,
  // copied, and walked where it stands, unless one of them holds it.
  const resolvePlacement = (node: any, selector: string, stack: string[], config: ConfigScope) => {
    const at: Placement = node[PLACEMENT]
    const mark = failures.length
    const done = (nodes: any[], failure?: IncludeProblem[]) => ({
      nodes,
      failure,
      inner: failures.slice(mark),
      selector,
      outside: [] as Source[],
      written: selector,
    })
    if (stateWaits) return { ...done([node]), waiting: true }
    const operands = operandReader(at.context, stack, at.here)
    const doc = { file: mainFile, node: asDocument(state) }
    let found: any[]
    try {
      found = outermost(keepBlocks(runSelector(selector, [doc], { home: [doc], readSource: operands.read })))
    } catch (e) {
      if (!(e instanceof SelectorError)) throw e
      if (operands.waits()) return { ...done([node]), waiting: true }
      return done(
        [],
        [
          {
            kind: 'operand',
            target: selector,
            message: `include selector cannot be read: ${e.message}`,
            chain: at.here,
          },
        ],
      )
    }
    if (operands.waits()) return { ...done([node]), waiting: true }
    if (found.some(block => inside.includes(block))) {
      const problem: IncludeProblem = {
        kind: 'cycle',
        target: selector,
        message: `include brings nothing: a block it would bring holds it: ${selector}`,
        chain: at.here,
      }
      alwaysShown.add(problem)
      return done([], [problem])
    }
    const nodes = found.flatMap(block => {
      const walked = walkNode(copyPlaced(block), at.context, stack, at.here, at.file, state, { ...config })
      return Array.isArray(walked) ? walked : [walked]
    })
    return done(nodes)
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
    // an include with no source, left for the second walk: the place it stands in
    placement?: Placement
    // left as written: a host with no files to give
    kept?: boolean
    // the external sources read, and the path as the directive writes it
    outside: Source[]
    written: string
  } => {
    const mark = failures.length
    reached.push(false)
    // the walked files a selection ran over, in order
    let roots: any[] | undefined
    const outside: Source[] = []
    const done = (nodes: any[], failure?: IncludeProblem[]) => ({
      nodes,
      failure,
      inner: failures.slice(mark),
      roots,
      selector,
      outside,
      written: parsed?.document ?? selector,
    })
    const line = getTextContentFromNode(node.content)?.toString().trim() ?? ''
    const split = splitDirective(line)
    const selector = split.selector
    let parsed: ParsedSelector | undefined
    let reason = ''
    if (selector && !split.unread) {
      try {
        parsed = readSelector(selector)
      } catch (e) {
        if (!(e instanceof SelectorError)) throw e
        reason = `: ${e.message}`
      }
    }
    if (parsed?.anchor) reached[reached.length - 1] = true
    // The directive stays in the tree as before when its selector is not read;
    // what it would have brought in is missing, and a reader of the tree cannot
    // tell that on its own.
    const fail = (problem: IncludeProblem, keep = false) => done(keep ? [withoutSet(node)] : [], [problem])
    // a selection with patterns and no source selects from the document itself
    const sameDocument =
      !!selector && !!parsed && !parsed.scheme && !parsed.document && !parsed.anchor && parsed.patterns.length > 0
    if (sameDocument && !secondWalk) return { ...done([node]), placement: { file, here, context } }
    if (sameDocument) return resolvePlacement(node, selector!, stack, config)
    // a host with no files to give leaves the other includes as they are written
    if (opts.onlySameDocument) return { ...done([node]), kept: true }
    if (!selector || !parsed || !parsed.scheme || !parsed.document) {
      return fail(
        {
          kind: 'unparsed-selector',
          target: line,
          message: `include selector cannot be read: ${line || '(empty)'}${reason}`,
          chain: here,
        },
        true,
      )
    }
    // a type declared on the directive decides the reading; one with no reader brings nothing
    const declared = split.mimeType === undefined ? undefined : formatOfType(split.mimeType)
    if (split.mimeType !== undefined && declared === undefined) {
      return fail({
        kind: 'format',
        target: selector,
        message: `include format is not supported: ${split.mimeType}: ${parsed.document}`,
        chain: here,
      })
    }
    const formatOf = (source: Source): ReadFormat => declared ?? source.format ?? formatOfFile(source.id)
    if (!schemes.includes(parsed.scheme)) {
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

    const wait = () => {
      if (!secondWalk) stateWaits = true
      return { ...done([node]), roots: undefined, waiting: true }
    }
    const located = provider.locate(parsed.document, context, false, here[here.length - 1], parsed.scheme)
    if (!located) return wait()
    const refused = refusal(located)
    if (refused !== undefined) {
      return located.masked
        ? fail({
            kind: 'source',
            target: selector,
            message: `include mask cannot be expanded: ${parsed.document}: ${refused}`,
            chain: here,
          })
        : fail(
            {
              kind: 'source',
              target: selector,
              message: `include source cannot be resolved: ${parsed.scheme}:${parsed.document}: ${refused}`,
              chain: here,
            },
            true,
          )
    }
    const { masked } = located
    // two answers with one id are one source
    const written = masked
      ? located.sources
      : located.sources.filter((source, at, all) => all.findIndex(other => other.id === source.id) === at)
    // a source already on the way in is not read again to find that out
    const back = !masked && written.length > 0 && stack.includes(written[0].id)
    const first = !masked && written.length && !back ? textOf(written[0]) : null
    if (first === undefined) return wait()
    if (!masked && !back && first === null) {
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
          alone = sourceOf(target, text, source.context, [...stack, target], here, formatOf(source))
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
        own = opts.parse(text, target, scoped ? config : undefined, { format: formatOf(source) })
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
      if (source.external !== undefined) outside.push(source)
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
        const problem: IncludeProblem = {
          kind: 'cycle',
          target: selector,
          message: `include brings nothing: ${parsed.document} is already being included`,
          chain: here,
        }
        if (masked) maskCycles.add(problem)
        return fail(problem)
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

    const operands = operandReader(context, stack, here)
    const readSource = operands.read
    // An include that waits for a later pass stands for blocks not yet known. The
    // universal pattern without a predicate would find every one of them, so the
    // include stays where it is written, among the found blocks; under other
    // patterns the selection may come out short of what it brings, and that is
    // said. One inside a found block comes with that block.
    const withWaiting = (found: any[]): any[] => {
      const chosen = new Set<any>(found)
      const merged: any[] = []
      let short = false
      const visit = (node: any, open: boolean): void => {
        if (!node || typeof node !== 'object') return
        if (Array.isArray(node)) return node.forEach(n => visit(n, open))
        if (chosen.has(node)) return void merged.push(node)
        if (node[WAITING]) {
          short = true
          if (open) merged.push(node)
          return
        }
        if (node.content !== undefined) visit(node.content, open && isWrapper(node))
      }
      docs.forEach(doc => visit(doc.node, true))
      if (!short) return found
      if (!parsed.patterns.some(pattern => pattern.blockType === '*' && !pattern.predicate)) {
        report({
          kind: 'incomplete-selection',
          target: selector,
          message: `include selection may be incomplete until an include in its source resolves: ${selector}`,
          chain: here,
        })
        return found
      }
      return merged.filter(node => chosen.has(node)).length === found.length ? merged : found
    }
    try {
      const found = outermost(
        keepBlocks(runSelector(selector, docs, { home: [{ file, node: asDocument(home) }], readSource })),
      )
      if (operands.waits()) return wait()
      return done(withoutLooseDirectives(placedFor(withWaiting(found))))
    } catch (e) {
      if (!(e instanceof SelectorError)) throw e
      if (operands.waits()) return wait()
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
    holder?: any,
  ): any => {
    if (!node || typeof node !== 'object') return node
    if (Array.isArray(node)) return walkList(node, context, stack, chain, file, home, config, holder)
    // the second walk resolves only the includes with no source; the others stay
    if (isIncludeBlock(node)) {
      if (secondWalk && !node[PLACEMENT]) return node
      return walkList([node], context, stack, chain, file, home, config, holder)
    }
    const wrapper = node.type === 'block' && (node.name === 'root' || node.name === '_folded_section')
    if (isSetTarget(node, holder)) markReached()

    if (Array.isArray(node.content)) {
      // a block is a lexical scope for the settings declared inside it
      const scope = node.type === 'block' && !wrapper ? { ...config } : config
      const inner = holderInside(node, holder)
      // a block the second walk is inside, as the block of the state it stands for
      const counted = secondWalk && node.type === 'block' && !wrapper
      if (counted) inside.push(placedFrom.get(node) ?? node)
      let content: any[]
      try {
        // the root of the document has no list around it to pass assignments on to
        escapeNext = secondWalk && wrapper && node !== state
        content = walkList(node.content, context, stack, chain, file, home, scope, inner)
      } finally {
        if (counted) inside.pop()
      }
      const copy = { ...node, content }
      const known = origin.get(node)
      if (known) origin.set(copy, known)
      const from = placedFrom.get(node)
      if (from) placedFrom.set(copy, from)
      opts.onCopy?.(node, copy)
      return copy
    }
    return node
  }

  try {
    const self = opts.self ? [opts.self] : []
    const first = walkNode(tree, opts.context, self, [], mainFile, tree, {})
    if (!placements) return unmark(first)
    state = first
    secondWalk = true
    return unmark(walkNode(first, opts.context, self, [], mainFile, tree, {}))
  } finally {
    flush()
  }
}

export { sourcesFromFiles } from './files'
export { assembleAsync, createSourceStore } from './async'
export type { AsyncSources, SourceStore, AssembleAsyncOptions } from './async'
