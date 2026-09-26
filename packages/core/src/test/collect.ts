import type { Location, RecognitionEvent } from '@podlite/schema'
import { coreProfile, prepareDocument, readDocument } from './documents'
import type { DocumentText, PreparedDocument, Profile } from './documents'
import { resourceKey } from './resources'
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
import { ok } from './types'

// A source of tests prepared the way convert prepares a document. The tree and
// the tables stay inside the process; only CollectedTest leaves it.
export type PreparedSource = PreparedDocument & { index: number }

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

const TEST_LINE = /^[ \t]*=(?:(?:begin|for)[ \t]+test|test)(?![a-zA-Z0-9_-])/

// A test the grammar could not close stays as the line of its directive.
const isBrokenTest = (node: unknown): boolean =>
  isObject(node) &&
  node.type === 'para' &&
  node.error === true &&
  typeof node.value === 'string' &&
  TEST_LINE.test(node.value)

const readSource = (source: TestSource): Result<DocumentText, string> =>
  source.kind === 'text'
    ? ok({ name: source.name, text: source.text, baseDir: source.baseDir })
    : readDocument(source.path)

const prepare = (
  source: TestSource,
  index: number,
  profile: Profile,
  problems: CollectionProblem[],
): PreparedSource | undefined => {
  const label = source.kind === 'file' ? source.path : source.name
  const read = readSource(source)
  if (read.ok === false) {
    problems.push({ kind: 'unreadable-source', source: label, message: read.error })
    return undefined
  }
  const prepared = prepareDocument(read.value, { profile })
  if (prepared.ok === false) {
    problems.push({ kind: 'implementation-error', source: label, message: prepared.error })
    return undefined
  }
  const { errors, warnings } = prepared.value
  for (const problem of errors) problems.push({ kind: 'include', severity: 'error', source: label, problem })
  for (const problem of warnings) problems.push({ kind: 'include', severity: 'warning', source: label, problem })
  return { ...prepared.value, index }
}

const placeOf = (node: object, prepared: PreparedSource): Place => {
  const where = prepared.origin.get(node)
  const location = isObject(node) && isLocation(node.location) ? node.location : undefined
  return { file: where ? prepared.identify(where.file) : prepared.name, location }
}

const keyOf = (place: Place): string =>
  `${place.file}:${place.location?.start.offset ?? '?'}:${place.location?.end.offset ?? '?'}`

// The settings in effect for the blocks of a test: each block by name with its
// options in a fixed order. A place it is brought to and what the reading adds
// to it are no part of them.
const settingsOf = (node: unknown): string => {
  const parts: string[] = []
  const visit = (n: unknown): void => {
    if (Array.isArray(n)) return n.forEach(visit)
    if (!isObject(n)) return
    if (n.type === 'block' && typeof n.name === 'string' && n.name !== '_folded_section') {
      const options = (Array.isArray(n.config) ? n.config : [])
        .filter(isObject)
        .map(c => `${String(c.name)}=${String(c.type)}:${JSON.stringify(c.value)}`)
        .sort()
      parts.push(`${n.name}(${options.join(',')})`)
    }
    visit(n.content)
  }
  visit(node)
  return parts.join(';')
}

// one test is the same written block under the same settings
const identityOf = (place: Place, node: unknown): string => `${keyOf(place)}:${settingsOf(node)}`

type Found = { event: RecognitionEvent; file: string }

// A node a plugin wraps children in stands for its children: the list around
// items has no place of its own, and a folded section has the place of its
// heading alone.
const located = (node: unknown): unknown[] =>
  isObject(node) && Array.isArray(node.content) && (!isLocation(node.location) || node.name === '_folded_section')
    ? node.content.flatMap(located)
    : [node]

const inRange = (event: RecognitionEvent, location: Location): boolean =>
  event.location.start.offset >= location.start.offset && event.location.end.offset <= location.end.offset

// Every block under the test is read in the file it was written in, so a block
// an include brings in is checked against the lines of its own file.
const recognitionOf = (block: Block, prepared: PreparedSource): { unknown: Found[]; broken: Found[] } => {
  const seen = new Map<string, Set<RecognitionEvent>>()
  // blocks that close what they hold: a line opened inside one is not closed after it
  const containers: Array<{ file: string; location: Location }> = []
  const visit = (node: unknown): void => {
    if (!isObject(node)) return
    if (isLocation(node.location)) {
      const { file } = placeOf(node, prepared)
      const inFile = seen.get(file) ?? new Set<RecognitionEvent>()
      for (const event of prepared.recognition.get(file) ?? []) {
        if (inRange(event, node.location)) inFile.add(event)
      }
      seen.set(file, inFile)
      if (node.type === 'block' && node.name !== '_folded_section') containers.push({ file, location: node.location })
    }
    childrenOf(node).forEach(visit)
  }
  childrenOf(block).forEach(visit)

  const scopeOf = (event: RecognitionEvent, file: string): string => {
    let best: Location | undefined
    for (const c of containers) {
      if (c.file !== file || !inRange(event, c.location)) continue
      if (!best || c.location.end.offset - c.location.start.offset < best.end.offset - best.start.offset) {
        best = c.location
      }
    }
    return `${file}:${best ? best.start.offset : 'test'}`
  }

  // a closing line pairs with the opening line before it in the same block,
  // whatever blank lines split the text between them
  const broken: Found[] = []
  const scopes = new Map<string, Found[]>()
  for (const [file, events] of seen) {
    for (const event of events) {
      const key = scopeOf(event, file)
      scopes.set(key, [...(scopes.get(key) ?? []), { event, file }])
    }
  }
  for (const found of scopes.values()) {
    const open: string[] = []
    found.sort((a, b) => a.event.location.start.offset - b.event.location.start.offset)
    for (const one of found) {
      const { event } = one
      if (event.kind === 'unreadable-directive') broken.push(one)
      else if (event.marker === 'begin') open.push(event.name)
      else if (event.marker === 'end') {
        const at = open.lastIndexOf(event.name)
        if (at === -1) broken.push(one)
        else open.splice(at, 1)
      }
    }
  }
  broken.sort((a, b) => a.event.location.start.offset - b.event.location.start.offset)

  // an unknown block is a child of the test only when it stayed text right
  // under the test; inside a table or another block it belongs to that block
  const unknown: Found[] = []
  for (const child of childrenOf(block).flatMap(located)) {
    if (!isObject(child) || child.type !== 'para' || !isLocation(child.location)) continue
    const { file } = placeOf(child, prepared)
    for (const event of seen.get(file) ?? []) {
      if (event.kind === 'unknown-directive' && event.marker !== 'end' && inRange(event, child.location)) {
        unknown.push({ event, file })
      }
    }
  }
  unknown.sort((a, b) => a.event.location.start.offset - b.event.location.start.offset)
  return { unknown, broken }
}

const shapeOf = (
  block: Block,
  prepared: PreparedSource,
  asserts: AssertDecl[],
  resources: ResourceDecl[],
): TestShape => {
  const { unknown, broken } = recognitionOf(block, prepared)
  // an unknown block is skipped even when the rest of the test is broken
  const [first] = unknown
  if (first && first.event.kind === 'unknown-directive') {
    return {
      kind: 'unknown-child',
      name: first.event.name,
      place: { file: first.file, location: first.event.location },
    }
  }
  const [damage] = broken
  if (damage) {
    const { event } = damage
    const message =
      event.kind === 'unknown-directive'
        ? `closing line of a block that is not open: =end ${event.name}`
        : 'a directive line inside the test cannot be read'
    return { kind: 'malformed', message, place: { file: damage.file, location: event.location } }
  }
  const named = new Set<string>()
  for (const r of resources) {
    if (!r.name) return { kind: 'invalid', message: 'a resource has no :name', place: r.place }
    const key = resourceKey(r.name)
    if (key === undefined)
      return { kind: 'invalid', message: `a resource name leaves the test: ${r.name}`, place: r.place }
    if (named.has(key)) return { kind: 'invalid', message: `two resources are named ${r.name}`, place: r.place }
    named.add(key)
  }
  return asserts.length === 0 ? { kind: 'no-assertions' } : { kind: 'runnable' }
}

const readTest = (block: Block, prepared: PreparedSource): CollectedTest => {
  const place = placeOf(block, prepared)
  const asserts: AssertDecl[] = []
  const resources: ResourceDecl[] = []
  let fixture: FixtureDecl | undefined
  let fixtures = 0
  for (const child of childrenOf(block).flatMap(located)) {
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
  return {
    key: identityOf(place, block),
    id: stringOption(block, 'id'),
    caption: stringOption(block, 'caption'),
    place,
    obtainedFrom: prepared.index,
    shape: shapeOf(block, prepared, asserts, resources),
    asserts,
    resources,
  }
}

const brokenTest = (node: object, prepared: PreparedSource): CollectedTest => {
  const place = placeOf(node, prepared)
  return {
    key: identityOf(place, node),
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

/*
=begin pod :kind<export>

=head2 collectTests

Reads each file of tests the way convert reads a document, includes resolved, and
finds the tests in it with the file and line each is written at. A test inside
another, and one inside a code block or a fixture, is not collected. An include that
could not be resolved is a problem of the collection.

=end pod
*/
export const collectTests = (sources: TestSource[], profile: Profile = coreProfile): Collection => {
  const problems: CollectionProblem[] = []
  const prepared: PreparedSource[] = []
  sources.forEach((source, index) => {
    const one = prepare(source, index, profile, problems)
    if (one) prepared.push(one)
  })
  return { sources: prepared, tests: prepared.flatMap(findTests), problems }
}

// Obtained twice, a test runs once only when every assertion reads a fixture or
// a source it names each time; one that reads the document around it runs
// where it was obtained, one that reads a supplied document runs per document.
/*
=begin pod :kind<export>

=head2 planRuns

Decides how often each collected test runs. A test obtained from several files runs
once when all its assertions read a fixture or a source they name; one that reads the
document around it runs where it was obtained; one that reads a supplied document
runs once per document.

=end pod
*/
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
