import * as fs from 'fs'
import * as path from 'path'
import type { Location, RecognitionEvent } from '@podlite/schema'
import { podlite } from '../index'
import { refreshTocs } from '../refresh-tocs'
import { resolveIncludes, IncludeOrigin, IncludeProblem } from '../resolve-includes'
import type {
  AssertDecl,
  CollectedTest,
  CollectionProblem,
  FixtureDecl,
  Place,
  PlannedRun,
  ResourceDecl,
  Result,
  TestShape,
  TestSource,
} from './types'
import { err, ok } from './types'

// A source of tests read and prepared the way convert prepares a document. The
// tree and the tables stay inside the process; only CollectedTest leaves it.
export type PreparedSource = {
  index: number
  name: string
  text: string
  tree: unknown
  origin: WeakMap<object, IncludeOrigin>
  recognition: Map<string, RecognitionEvent[]>
  // the name a file of this source is known by in keys and places
  identify: (file: string) => string
}

export type Collection = {
  sources: PreparedSource[]
  tests: CollectedTest[]
  problems: CollectionProblem[]
}

type Block = {
  type: 'block'
  name: string
  config?: Array<{ name: string; value: unknown }>
  content?: unknown[]
  location?: Location
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const isBlock = (value: unknown): value is Block =>
  isObject(value) && value.type === 'block' && typeof value.name === 'string'

const isLocation = (value: unknown): value is Location =>
  isObject(value) && isObject(value.start) && typeof value.start.offset === 'number'

const childrenOf = (value: unknown): unknown[] =>
  isObject(value) && Array.isArray(value.content) ? value.content : Array.isArray(value) ? value : []

const option = (block: Block, name: string): unknown => (block.config ?? []).find(c => c.name === name)?.value

const stringOption = (block: Block, name: string): string | undefined => {
  const value = option(block, name)
  return typeof value === 'string' ? value : undefined
}

const bodyOf = (block: Block): string =>
  childrenOf(block)
    .map(c => (isObject(c) && c.type === 'verbatim' && typeof c.value === 'string' ? c.value : ''))
    .join('')

// The vertical bar is what tells a source from a block name; one inside quotes
// or brackets belongs to a value or to an operand of `in`.
export const splitSource = (expression: string): { source?: string; selection: string } => {
  let depth = 0
  let quote = ''
  for (let i = 0; i < expression.length; i++) {
    const c = expression[i]
    if (quote) {
      if (c === quote) quote = ''
      continue
    }
    if (c === "'" || c === '"') quote = c
    else if ('[(<{'.includes(c)) depth++
    else if ('])>}'.includes(c)) depth = Math.max(0, depth - 1)
    else if (c === '|' && depth === 0) {
      const source = expression.slice(0, i).trim()
      return { source: source || undefined, selection: expression.slice(i + 1).trim() }
    }
  }
  const trimmed = expression.trim()
  // a source with no selection after it brings in the whole document
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ? { source: trimmed, selection: '' } : { selection: trimmed }
}

const canonical = (file: string): string => {
  try {
    return fs.realpathSync.native(file)
  } catch {
    return path.resolve(file)
  }
}

const TEST_LINE = /^[ \t]*=(?:(?:begin|for)[ \t]+test|test)(?![a-zA-Z0-9_-])/

// A test the grammar could not close stays as the line of its directive.
const isBrokenTest = (node: unknown): boolean =>
  isObject(node) &&
  node.type === 'para' &&
  node.error === true &&
  typeof node.value === 'string' &&
  TEST_LINE.test(node.value)

const readSource = (source: TestSource): Result<{ name: string; text: string; baseDir: string }, string> => {
  if (source.kind === 'text') return ok({ name: source.name, text: source.text, baseDir: source.baseDir })
  try {
    const text = fs.readFileSync(source.path, 'utf-8')
    return ok({ name: canonical(source.path), text, baseDir: path.dirname(path.resolve(source.path)) })
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e))
  }
}

const includeSeverity = (problem: IncludeProblem): 'error' | 'warning' =>
  problem.kind === 'ambiguous' ? 'warning' : 'error'

const prepare = (source: TestSource, index: number, problems: CollectionProblem[]): PreparedSource | undefined => {
  const label = source.kind === 'file' ? source.path : source.name
  const read = readSource(source)
  if (read.ok === false) {
    problems.push({ kind: 'unreadable-source', source: label, message: read.error })
    return undefined
  }
  const { name, text, baseDir } = read.value
  const p = podlite({ importPlugins: true })
  const recognition = new Map<string, RecognitionEvent[]>()
  const identify = (file: string): string => (file === name ? name : canonical(file))
  const parseToAst = (body: string, file: string): unknown => {
    const events: RecognitionEvent[] = []
    const tree = p.toAst(p.parse(body, { podMode: 1, recognition: events }))
    recognition.set(identify(file), events)
    return tree
  }
  const origin = new WeakMap<object, IncludeOrigin>()
  const onInclude = (problem: IncludeProblem): void => {
    problems.push({ kind: 'include', severity: includeSeverity(problem), source: label, problem })
  }
  try {
    const resolved = resolveIncludes(parseToAst(text, name), {
      baseDir,
      parse: parseToAst,
      file: name,
      text,
      self: source.kind === 'file' ? source.path : undefined,
      origin,
      onError: onInclude,
      onWarning: onInclude,
    })
    const tree = refreshTocs(resolved, p.parse(text, { podMode: 1 }), name, origin)
    return { index, name, text, tree, origin, recognition, identify }
  } catch (e) {
    problems.push({ kind: 'implementation-error', source: label, message: e instanceof Error ? e.message : String(e) })
    return undefined
  }
}

const placeOf = (node: object, prepared: PreparedSource): Place => {
  const where = prepared.origin.get(node)
  const location = isObject(node) && isLocation(node.location) ? node.location : undefined
  return { file: where ? prepared.identify(where.file) : prepared.name, location }
}

const keyOf = (place: Place): string =>
  `${place.file}:${place.location?.start.offset ?? '?'}:${place.location?.end.offset ?? '?'}`

const within = (event: RecognitionEvent, block: Block): boolean => {
  const start = block.location?.start.offset
  const end = block.location?.end.offset
  if (start === undefined || end === undefined) return false
  return event.location.start.offset > start && event.location.end.offset <= end
}

const shapeOf = (
  block: Block,
  place: Place,
  events: RecognitionEvent[],
  asserts: AssertDecl[],
  resources: ResourceDecl[],
): TestShape => {
  const inside = events.filter(e => within(e, block))
  // an unknown block is skipped even when the rest of the test is broken
  for (const e of inside) {
    if (e.kind === 'unknown-directive' && e.marker !== 'end') {
      return { kind: 'unknown-child', name: e.name, place: { file: place.file, location: e.location } }
    }
  }
  const [broken] = inside
  if (broken) {
    const message =
      broken.kind === 'unknown-directive'
        ? `closing line of a block that is not open: =end ${broken.name}`
        : 'a directive line inside the test cannot be read'
    return { kind: 'malformed', message, place: { file: place.file, location: broken.location } }
  }
  const named = new Set<string>()
  for (const r of resources) {
    if (!r.name) return { kind: 'invalid', message: 'a resource has no :name', place: r.place }
    if (named.has(r.name)) return { kind: 'invalid', message: `two resources are named ${r.name}`, place: r.place }
    named.add(r.name)
  }
  return asserts.length === 0 ? { kind: 'no-assertions' } : { kind: 'runnable' }
}

const readTest = (block: Block, prepared: PreparedSource): CollectedTest => {
  const place = placeOf(block, prepared)
  const asserts: AssertDecl[] = []
  const resources: ResourceDecl[] = []
  let fixture: FixtureDecl | undefined
  let fixtures = 0
  for (const child of childrenOf(block)) {
    if (!isBlock(child)) continue
    const childPlace = placeOf(child, prepared)
    if (child.name === 'fixture') {
      fixture = { index: fixtures++, body: bodyOf(child), place: childPlace }
    } else if (child.name === 'resource') {
      resources.push({ name: stringOption(child, 'name') ?? '', body: bodyOf(child), place: childPlace })
    } else if (child.name === 'assert') {
      const expression = bodyOf(child).trim()
      asserts.push({
        index: asserts.length,
        expression,
        absent: option(child, 'absent') === true,
        caption: stringOption(child, 'caption'),
        place: childPlace,
        source: splitSource(expression).source,
        fixture,
      })
    }
  }
  const events = prepared.recognition.get(place.file) ?? []
  return {
    key: keyOf(place),
    id: stringOption(block, 'id'),
    caption: stringOption(block, 'caption'),
    place,
    obtainedFrom: prepared.index,
    shape: shapeOf(block, place, events, asserts, resources),
    asserts,
    resources,
  }
}

const brokenTest = (node: object, prepared: PreparedSource): CollectedTest => {
  const place = placeOf(node, prepared)
  return {
    key: keyOf(place),
    place,
    obtainedFrom: prepared.index,
    shape: { kind: 'malformed', message: 'the test is not closed or holds a block that is not', place },
    asserts: [],
    resources: [],
  }
}

// A test met inside another is not a test to obtain, and a test block holds no
// section of the document around it.
const findTests = (prepared: PreparedSource): CollectedTest[] => {
  const found: CollectedTest[] = []
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit)
    if (!isObject(node)) return
    if (isBlock(node) && node.name === 'test') {
      found.push(readTest(node, prepared))
      return
    }
    if (isBrokenTest(node)) {
      found.push(brokenTest(node, prepared))
      return
    }
    childrenOf(node).forEach(visit)
  }
  visit(prepared.tree)
  return found
}

export const collectTests = (sources: TestSource[]): Collection => {
  const problems: CollectionProblem[] = []
  const prepared: PreparedSource[] = []
  sources.forEach((source, index) => {
    const one = prepare(source, index, problems)
    if (one) prepared.push(one)
  })
  return { sources: prepared, tests: prepared.flatMap(findTests), problems }
}

// Obtained twice, a test runs once only when every assertion reads a fixture or
// a source it names each time; one that reads the document around it runs
// where it was obtained, one that reads a supplied document runs per document.
export const planRuns = (tests: CollectedTest[], supplied: number): PlannedRun[] => {
  const groups = new Map<string, CollectedTest[]>()
  for (const test of tests) {
    const group = groups.get(test.key)
    if (group) group.push(test)
    else groups.set(test.key, [test])
  }
  const runs: PlannedRun[] = []
  for (const obtained of groups.values()) {
    const [test] = obtained
    const unnamed = test.shape.kind === 'runnable' ? test.asserts.filter(a => a.source === undefined) : []
    if (supplied > 0 && unnamed.length > 0) {
      for (let document = 0; document < supplied; document++) {
        runs.push({ test, obtained, context: { kind: 'supplied', document } })
      }
    } else if (supplied === 0 && unnamed.some(a => a.fixture === undefined)) {
      for (const one of obtained)
        runs.push({ test: one, obtained: [one], context: { kind: 'containing', source: one.obtainedFrom } })
    } else {
      runs.push({ test, obtained, context: { kind: 'fixture-or-named' } })
    }
  }
  return runs
}
