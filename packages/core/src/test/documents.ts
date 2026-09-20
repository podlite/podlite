import * as fs from 'fs'
import * as path from 'path'
import type { Location, ParseDiagnostic, PodliteDocument, PodNode, RecognitionEvent } from '@podlite/schema'
import { podlite } from '../index'
import { refreshTocs } from '../refresh-tocs'
import { resolveIncludes, IncludeOrigin, IncludeProblem, SourceProvider } from '../resolve-includes'
import type { Result } from './types'
import { err, ok } from './types'

type Reader = {
  toTree: (text: string, recognition: RecognitionEvent[], diagnostics: ParseDiagnostic[]) => unknown
  written: (text: string) => unknown
}

// What reads a document for an assertion. A reader is made per document, so no
// state of one parse reaches the next.
/*
=begin pod :kind<export>

=head2 Profile

How documents are read for assertions: the name the report gives it, a reader made
fresh for each document, and the selections it can run.

=end pod
*/
export type Profile = {
  name: string
  reader: () => Reader
  // a selection the implementation reads but cannot run; every one it reads
  // runs when not given
  supports?: (selection: string) => boolean
}

const readerOf = (importPlugins: boolean) => (): Reader => {
  const p = podlite({ importPlugins })
  return {
    toTree: (text, recognition, diagnostics) => p.toAst(p.parse(text, { podMode: 1, recognition, diagnostics })),
    written: text => p.parse(text, { podMode: 1 }),
  }
}

/*
=begin pod :kind<export>

=head2 coreProfile

The profile the command uses: the plugins of this package, so a Markdown section is
read into blocks.

=end pod
*/
export const coreProfile: Profile = { name: 'core', reader: readerOf(true) }

// without the plugins of other packages: Markdown, diagrams, images
/*
=begin pod :kind<export>

=head2 schemaProfile

The parser alone, without plugins of other packages. A Markdown section stays one
block, so a test that reads into one does not hold under it.

=end pod
*/
export const schemaProfile: Profile = { name: 'schema', reader: readerOf(false) }

export type PreparedDocument = {
  name: string
  text: string
  baseDir: string
  tree: PodNode | PodliteDocument
  origin: WeakMap<object, IncludeOrigin>
  recognition: Map<string, RecognitionEvent[]>
  // the name a file of this document is known by in keys and places
  identify: (file: string) => string
  // includes that lost content; the tree is what is left without them
  errors: IncludeProblem[]
  warnings: IncludeProblem[]
  // blocks whose content comes from a source this runner does not read
  unread: Array<{ source: string; message: string; location?: Location }>
  profile: string
}

export type DocumentText = {
  name: string
  text: string
  baseDir: string
  // the path the text was read from, when it was: an include back to it is a cycle
  self?: string
}

export const canonical = (file: string): string => {
  try {
    return fs.realpathSync.native(file)
  } catch {
    return path.resolve(file)
  }
}

const isLosing = (problem: IncludeProblem): boolean => problem.kind !== 'ambiguous'

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const isLocation = (value: unknown): value is Location =>
  isObject(value) && isObject(value.start) && typeof value.start.offset === 'number'

// A data table reads data: itself; any other source is left for a publisher,
// and the block stays as written, holding none of the rows.
const unreadSources = (tree: unknown): PreparedDocument['unread'] => {
  const found: PreparedDocument['unread'] = []
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit)
    if (!isObject(node)) return
    if (node.type === 'block' && node.name === 'data-table' && Array.isArray(node.config)) {
      const src = node.config.find(c => isObject(c) && c.name === 'src')
      if (isObject(src) && typeof src.value === 'string') {
        found.push({
          source: src.value,
          message: 'a data table reads a source the runner does not read',
          location: isLocation(node.location) ? node.location : undefined,
        })
      }
    }
    visit(node.content)
  }
  visit(tree)
  return found
}

// The stages convert goes through: each file read and transformed on its own,
// then the includes, then the tables of contents of the document itself.
export const prepareDocument = (
  input: DocumentText,
  opts: { profile: Profile; provider?: SourceProvider },
): Result<PreparedDocument, string> => {
  const { name, text, baseDir } = input
  const reader = opts.profile.reader()
  const recognition = new Map<string, RecognitionEvent[]>()
  const identify = (file: string): string => (file === name ? name : canonical(file))
  const lost: PreparedDocument['unread'] = []
  const toTree = (body: string, file: string): unknown => {
    const events: RecognitionEvent[] = []
    const diagnostics: ParseDiagnostic[] = []
    const tree = reader.toTree(body, events, diagnostics)
    recognition.set(identify(file), events)
    for (const d of diagnostics) {
      // a table whose data could not be had is rendered empty; one whose data
      // holds no rows was read and is empty
      if (d.code === 'table-source-unreadable' && !/source has no rows/.test(d.message)) {
        lost.push({ source: identify(file), message: d.message, location: d.location })
      }
    }
    return tree
  }
  const origin = new WeakMap<object, IncludeOrigin>()
  const errors: IncludeProblem[] = []
  const warnings: IncludeProblem[] = []
  const note = (problem: IncludeProblem): void => {
    ;(isLosing(problem) ? errors : warnings).push(problem)
  }
  try {
    const resolved = resolveIncludes(toTree(text, name), {
      baseDir,
      parse: toTree,
      file: name,
      text,
      self: input.self,
      origin,
      provider: opts.provider,
      onError: note,
      onWarning: note,
    })
    const tree = refreshTocs(resolved, reader.written(text), name, origin)
    return ok({
      name,
      text,
      baseDir,
      tree,
      origin,
      recognition,
      identify,
      errors,
      warnings,
      unread: [...lost, ...unreadSources(tree)],
      profile: opts.profile.name,
    })
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e))
  }
}

export const readDocument = (file: string): Result<DocumentText, string> => {
  try {
    const text = fs.readFileSync(file, 'utf-8')
    return ok({ name: canonical(file), text, baseDir: path.dirname(path.resolve(file)), self: file })
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e))
  }
}
