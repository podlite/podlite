import * as fs from 'fs'
import * as path from 'path'
import type { PodliteDocument, PodNode, RecognitionEvent } from '@podlite/schema'
import { podlite } from '../index'
import { refreshTocs } from '../refresh-tocs'
import { resolveIncludes, IncludeOrigin, IncludeProblem, SourceProvider } from '../resolve-includes'
import type { Result } from './types'
import { err, ok } from './types'

type Reader = {
  toTree: (text: string, recognition: RecognitionEvent[]) => unknown
  written: (text: string) => unknown
}

// What reads a document for an assertion. A reader is made per document, so no
// state of one parse reaches the next.
export type Profile = {
  name: string
  reader: () => Reader
}

const readerOf = (importPlugins: boolean) => (): Reader => {
  const p = podlite({ importPlugins })
  return {
    toTree: (text, recognition) => p.toAst(p.parse(text, { podMode: 1, recognition })),
    written: text => p.parse(text, { podMode: 1 }),
  }
}

export const coreProfile: Profile = { name: 'core', reader: readerOf(true) }

// without the plugins of other packages: Markdown, diagrams, images
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
  const toTree = (body: string, file: string): unknown => {
    const events: RecognitionEvent[] = []
    const tree = reader.toTree(body, events)
    recognition.set(identify(file), events)
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
