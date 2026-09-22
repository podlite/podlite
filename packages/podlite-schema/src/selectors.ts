import {
  getFromTree,
  getNodeId,
  getTextContentFromNode,
  isSemanticBlock,
  makeAttrs,
  PodliteDocument,
  PodNode,
} from './index'
import { ConfigItem } from './types'
import { parseAttributes } from './helpers/parseAttributes'

/*
=begin pod

=head2 Selector mechanics — pure AST queries

These helpers parse and resolve C<=include> / C<=table> source references
against a corpus of documents. They live in C<@podlite/schema> because
they perform no I/O and depend only on AST traversal — host-driven
features (live preview, build-time inclusion) consume them through a
generic C<SelectorDoc> interface.

=begin code
SELECTOR     := [EXTERNAL_SOURCE '|'] PATTERN_LIST?
PATTERN_LIST := PATTERN (',' PATTERN)*
PATTERN      := BLOCK_TYPE PREDICATE?
BLOCK_TYPE   := identifier | '*'
PREDICATE    := '[' CONDITION (WS CONDITION)* ']'
CONDITION    := ':' MODIFIER? attr-name VALUE_SPEC?
MODIFIER     := '!?' | '!' | '?'
VALUE_SPEC   := '<' angle-content '>' | '~<' angle-content '>'
=end code

Supported schemes: C<doc> (lookup by document ID / title), C<file> (path
match against C<doc.file>, with glob support).

=end pod
*/

/**
 * Minimal corpus item that the selector engine needs. Concrete consumers
 * (publisher's `publishRecord`, editor preview, etc.) supply richer
 * objects; only `file` and `node` are read here.
 */
export type SelectorDoc = {
  file: string
  node: PodNode | PodliteDocument
}

export type Condition = {
  modifier?: '!' | '?' | '!?'
  attrName: string
  valueSpec?: ValueSpec
}

export type Pattern = {
  blockType: string
  predicate?: Condition[]
}

export type ParsedSelector = {
  scheme?: string
  document?: string
  anchor?: string
  patterns: Pattern[]
}

// --- predicate parser ---------------------------------------------------

export type ValueSpec =
  | { kind: 'angle'; value: string }
  | { kind: 'contains'; value: string }
  | { kind: 'paren'; value: string }
  | { kind: 'in'; value: string }

const isIdentStart = (c: string): boolean => /[a-zA-Z_]/.test(c)
const isIdentCont = (c: string): boolean => /[a-zA-Z0-9_-]/.test(c)

type Typed = { value: unknown; type?: string }

// A value is read by the same grammar as a declaration: the delimiters around
// it decide whether it is a string, a list or a number, so an operator means
// the same thing in a predicate as on a block.
const readValue = (src: string): Typed | undefined => {
  const items = parseAttributes(src)
  return items.length === 1 && items[0].name === 'x' ? { value: items[0].value, type: items[0].type } : undefined
}

const readOperand = (raw: string): Typed | undefined => readValue(`:x<${raw}>`)

const valuesOf = (typed: Typed): unknown[] => (Array.isArray(typed.value) ? typed.value : [typed.value])

// Read an angle-bracketed value starting at `<`. Returns the inner content
// (without delimiters) and the index right after the closing `>`.
// Nested `<>` pairs are matched recursively.
const readAngleValue = (s: string, start: number): { value: string; end: number } | undefined => {
  if (s[start] !== '<') return undefined
  let depth = 1
  let i = start + 1
  while (i < s.length && depth > 0) {
    if (s[i] === '<') depth++
    else if (s[i] === '>') {
      depth--
      if (depth === 0) return { value: s.slice(start + 1, i), end: i + 1 }
    }
    i++
  }
  return undefined
}

const QUOTES: Record<string, string> = { "'": "'", '"': '"', '｢': '｣' }

// Read a parenthesised value starting at `(`. A quotation mark opens a string
// only where an element begins, so an apostrophe inside a word stays a letter.
const readParenValue = (s: string, start: number): { value: string; end: number } | undefined => {
  if (s[start] !== '(') return undefined
  let depth = 1
  let prev = '('
  let i = start + 1
  while (i < s.length) {
    const c = s[i]
    const close = QUOTES[c]
    if (close && (prev === '(' || prev === ',' || /\s/.test(prev))) {
      const at = s.indexOf(close, i + 1)
      if (at === -1) return undefined
      i = at + 1
      prev = close
      continue
    }
    if (c === '(') depth++
    else if (c === ')') {
      depth--
      if (depth === 0) return { value: s.slice(start + 1, i), end: i + 1 }
    }
    prev = c
    i++
  }
  return undefined
}

// The index right after the `]` that closes the predicate opened at `start`.
// Brackets, parentheses and strings inside a value do not close it.
const skipPredicate = (s: string, start: number): number | undefined => {
  let i = start + 1
  while (i < s.length) {
    const c = s[i]
    if (c === ']') return i + 1
    const read = c === '<' ? readAngleValue(s, i) : c === '(' ? readParenValue(s, i) : undefined
    if ((c === '<' || c === '(') && !read) return undefined
    i = read ? read.end : i + 1
  }
  return undefined
}

// Split a pattern list at a separator that stands outside every predicate.
const splitOutsidePredicates = (s: string, separator: string): string[] | undefined => {
  const chunks: string[] = []
  let from = 0
  let i = 0
  while (i < s.length) {
    if (s[i] === '[') {
      const end = skipPredicate(s, i)
      if (end === undefined) return undefined
      i = end
      continue
    }
    if (s[i] === separator) {
      chunks.push(s.slice(from, i))
      from = i + 1
    }
    i++
  }
  chunks.push(s.slice(from))
  return chunks
}

// Literal operands of `in`: numbers and non-empty strings, separated by commas
// or, in angle brackets, by whitespace.
const readLiterals = (operands: string): Typed | undefined => {
  if (!operands) return undefined
  const angle = operands.startsWith('<') ? readAngleValue(operands, 0) : undefined
  if (angle && angle.end !== operands.length) return undefined
  const typed = angle ? readOperand(angle.value) : readValue(`:x(${operands})`)
  if (!typed) return undefined
  const values = valuesOf(typed)
  const literal = (v: unknown): boolean => typeof v === 'number' || (typeof v === 'string' && v !== '')
  return values.length > 0 && values.every(literal) ? typed : undefined
}

// What follows the opening parenthesis is a value when the declaration grammar
// reads it as one, and otherwise the name of an operation.
const parenCondition = (modifier: Condition['modifier'], attrName: string, inner: string): Condition | undefined => {
  if (readValue(`:x(${inner})`)) return { modifier, attrName, valueSpec: { kind: 'paren', value: inner } }
  const operation = inner.match(/^\s*([a-zA-Z_][a-zA-Z0-9_-]*)(?:\s+([\s\S]*))?$/)
  if (!operation || operation[1] !== 'in' || modifier) return undefined
  const operands = (operation[2] ?? '').trim()
  if (!readLiterals(operands)) return undefined
  return { attrName, valueSpec: { kind: 'in', value: operands } }
}

const parseCondition = (raw: string): Condition | undefined => {
  const s = raw.trim()
  if (!s.startsWith(':')) return undefined
  let i = 1

  let modifier: Condition['modifier']
  if (s.startsWith('!?', i)) {
    modifier = '!?'
    i += 2
  } else if (s[i] === '!') {
    modifier = '!'
    i += 1
  } else if (s[i] === '?') {
    modifier = '?'
    i += 1
  }

  if (i >= s.length || !isIdentStart(s[i])) return undefined
  const nameStart = i
  while (i < s.length && isIdentCont(s[i])) i++
  const attrName = s.slice(nameStart, i)

  if (i >= s.length) return { modifier, attrName }

  if (s[i] === '~' && s[i + 1] === '<') {
    const read = readAngleValue(s, i + 1)
    if (!read || read.end !== s.length) return undefined
    // an empty list occurs among any values, so the condition would test nothing
    const operand = readOperand(read.value)
    if (!operand || valuesOf(operand).length === 0) return undefined
    return { modifier, attrName, valueSpec: { kind: 'contains', value: read.value } }
  }

  if (s[i] === '<') {
    const read = readAngleValue(s, i)
    if (!read || read.end !== s.length) return undefined
    return { modifier, attrName, valueSpec: { kind: 'angle', value: read.value } }
  }

  if (s[i] === '(') {
    const read = readParenValue(s, i)
    if (!read || read.end !== s.length) return undefined
    return parenCondition(modifier, attrName, read.value)
  }

  return undefined
}

// Split a predicate body into conditions at whitespace outside any value.
const splitConditions = (body: string): string[] | undefined => {
  const chunks: string[] = []
  let from = 0
  let i = 0
  while (i < body.length) {
    const c = body[i]
    if (c === '<' || c === '(') {
      const read = c === '<' ? readAngleValue(body, i) : readParenValue(body, i)
      if (!read) return undefined
      i = read.end
      continue
    }
    if (c === '>') return undefined
    if (/\s/.test(c)) {
      if (i > from) chunks.push(body.slice(from, i))
      from = i + 1
    }
    i++
  }
  if (from < body.length) chunks.push(body.slice(from))
  return chunks
}

const parsePredicate = (body: string): Condition[] | undefined => {
  const chunks = splitConditions(body)
  if (!chunks) return undefined
  const conditions: Condition[] = []
  for (const chunk of chunks) {
    const cond = parseCondition(chunk)
    if (!cond) return undefined
    conditions.push(cond)
  }
  return conditions
}

const parsePattern = (raw: string): Pattern | undefined => {
  const s = raw.trim()
  if (!s) return undefined

  let blockType: string
  let i = 0
  if (s[0] === '*') {
    blockType = '*'
    i = 1
  } else if (isIdentStart(s[0])) {
    let j = 1
    while (j < s.length && isIdentCont(s[j])) j++
    blockType = s.slice(0, j)
    i = j
  } else {
    return undefined
  }

  // skip optional whitespace between block-type and predicate
  while (i < s.length && /\s/.test(s[i])) i++

  if (i >= s.length) return { blockType }

  if (s[i] !== '[' || skipPredicate(s, i) !== s.length) return undefined
  const body = s.slice(i + 1, s.length - 1).trim()
  if (!body) return undefined

  const predicate = parsePredicate(body)
  if (!predicate) return undefined

  return { blockType, predicate }
}

const parsePatternList = (filterPart: string): Pattern[] | undefined => {
  if (!filterPart) return []
  const chunks = splitOutsidePredicates(filterPart, ',')
  if (!chunks) return undefined
  const patterns: Pattern[] = []
  for (const chunk of chunks) {
    const trimmed = chunk.trim()
    if (!trimmed) continue
    const p = parsePattern(trimmed)
    if (!p) return undefined
    patterns.push(p)
  }
  return patterns
}

export const parseSelector = (selector: string): ParsedSelector | undefined => {
  const trimmed = selector.trim()
  if (!trimmed) return undefined

  // The first '|' separates the source from the pattern list. A source named
  // by a scheme is literal text up to the bar; elsewhere a bar inside a
  // predicate belongs to its value.
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9-]*:/.test(trimmed)
  const parts = hasScheme ? undefined : splitOutsidePredicates(trimmed, '|')
  const pipeIdx = hasScheme ? trimmed.indexOf('|') : parts && parts.length > 1 ? parts[0].length : -1
  const sourcePart = (pipeIdx === -1 ? trimmed : trimmed.slice(0, pipeIdx)).trim()
  const filterPart = pipeIdx === -1 ? '' : trimmed.slice(pipeIdx + 1).trim()

  const patterns = parsePatternList(filterPart)
  if (patterns === undefined) return undefined

  // Source: scheme:path or scheme:path#anchor. Scheme is identifier-shaped
  // so that bare predicates like `*[:attr<v>]` don't get consumed as scheme.
  const sourceMatch = sourcePart.match(/^([a-zA-Z][a-zA-Z0-9-]*):([^#]+)(?:#(.+))?$/)
  if (sourceMatch) {
    return {
      scheme: sourceMatch[1],
      document: sourceMatch[2].trim(),
      anchor: sourceMatch[3],
      patterns,
    }
  }

  if (patterns.length > 0) {
    return { patterns }
  }

  // No pipe — treat the whole input as a pattern-list (CLI-friendly shorthand
  // for filter-only selectors, e.g. `head1, code[:lang<python>]`).
  if (pipeIdx === -1) {
    const fallback = parsePatternList(sourcePart)
    if (fallback && fallback.length > 0) return { patterns: fallback }
  }

  return undefined
}

// --- predicate matcher --------------------------------------------------

// The declared value with its kind kept. makeAttrs flattens a list into the
// surrounding values, which loses the very thing equality compares. What a
// =config supplies is already on the block: the parser puts it there, within
// the block and the file the =config is written in.
const declaredValue = (node: PodNode, name: string): Typed | undefined => {
  const anyNode = node as unknown as { config?: ConfigItem[] }
  const own = (Array.isArray(anyNode.config) ? anyNode.config : []).find(c => c && c.name === name)
  return own ? { value: own.value, type: own.type } : undefined
}

const sameScalar = (a: unknown, b: unknown): boolean => typeof a === typeof b && a === b

// A list equals another list when their elements match one by one, in order; a
// value of one kind never equals a value of another.
const sameValue = (a: Typed, b: Typed): boolean => {
  if (Array.isArray(a.value) || Array.isArray(b.value)) {
    if (!Array.isArray(a.value) || !Array.isArray(b.value)) return false
    return a.value.length === b.value.length && a.value.every((item, i) => sameScalar(item, (b.value as unknown[])[i]))
  }
  return sameScalar(a.value, b.value)
}

const matchCondition = (node: PodNode, cond: Condition): boolean => {
  const attrs = makeAttrs(node, {})
  const exists = attrs.exists(cond.attrName)

  if (!cond.valueSpec) {
    switch (cond.modifier) {
      case undefined:
        return exists && Boolean(attrs.getFirstValue(cond.attrName))
      case '!':
        return exists && attrs.getFirstValue(cond.attrName) === false
      case '?':
        return exists
      case '!?':
        return !exists
    }
  }

  const declared = declaredValue(node, cond.attrName)
  const { kind, value } = cond.valueSpec
  const operand =
    kind === 'paren' ? readValue(`:x(${value})`) : kind === 'in' ? readLiterals(value) : readOperand(value)

  if (kind === 'angle' || kind === 'paren') {
    if (!exists || !declared || !operand) return false
    const equal = sameValue(declared, operand)
    return cond.modifier === '!' ? !equal : equal
  }

  // Membership runs over the values as declared. A string is one value, even
  // when it holds spaces, so a word taken from its middle is not a member.
  if (kind === 'contains') {
    if (!exists || !declared || !operand) return false
    const values = valuesOf(declared)
    const present = valuesOf(operand).every(wanted => values.some(held => sameScalar(held, wanted)))
    return cond.modifier === '!' ? !present : present
  }

  if (kind === 'in') {
    if (!exists || !declared || !operand) return false
    const operands = valuesOf(operand)
    return valuesOf(declared).some(held => operands.some(wanted => sameScalar(held, wanted)))
  }

  return false
}

// Within these blocks text written without a marker is a paragraph and lines
// set in from the margin are a code block. Anywhere else a para node is the
// text of the block around it: of an explicit =para, of a heading.
const IMPLICIT_HOLDERS = new Set(['root', 'pod', 'item', 'defn', 'nested', 'cell'])

type Walked = { type?: string; name?: string; content?: unknown }

// A node outside any block is in the document, and a document is a pod.
const holdsImplicit = (holder: Walked | undefined): boolean =>
  holder === undefined ||
  (holder.type === 'block' &&
    (IMPLICIT_HOLDERS.has(holder.name ?? '') || (Boolean(holder.name) && isSemanticBlock(holder))))

// The block a node stands for: the name of a block written with a directive,
// para or code for one written without, none for anything else. The term of
// a =defn is its heading, not a paragraph.
const blockNameOf = (node: Walked, holder: Walked | undefined): string | undefined => {
  if (node.type === 'block') return node.name
  if (node.type === 'code') return 'code'
  if (node.type === 'para' && node.name !== 'term' && holdsImplicit(holder)) return 'para'
  return undefined
}

// Replicate name/level handling from getFromTree for backward compat with
// 'head1' / 'item' style block-types. `*` stands for the blocks written with a
// directive only.
const blockTypeMatches = (node: PodNode, name: string, blockType: string): boolean => {
  const anyNode = node as unknown as { type?: string; level?: number }
  if (blockType === '*') return anyNode.type === 'block'
  if (name === blockType) return true
  const m = blockType.match(/^(head|item)(\d+)?$/)
  if (m) {
    const [, baseName, levelStr] = m
    if (name !== baseName) return false
    const expectedLevel = levelStr ? parseInt(levelStr, 10) : baseName === 'item' ? 1 : undefined
    if (expectedLevel === undefined) return true
    // Heading plugin stores level as the regex capture string; coerce.
    return Number(anyNode.level) === expectedLevel
  }
  return false
}

const matchesPattern = (node: PodNode, name: string, pattern: Pattern): boolean => {
  if (!blockTypeMatches(node, name, pattern.blockType)) return false
  if (!pattern.predicate) return true
  return pattern.predicate.every(c => matchCondition(node, c))
}

// Walk one document in source order. A block is matched against the
// configuration it carries; a =config met on the way is not applied again.
const collectMatches = (
  node: PodNode,
  holder: Walked | undefined,
  patterns: Pattern[],
  seen: Set<PodNode>,
  out: PodNode[],
): void => {
  if (Array.isArray(node)) {
    for (const child of node) collectMatches(child as PodNode, holder, patterns, seen, out)
    return
  }
  if (!node || typeof node !== 'object') return
  const anyNode = node as Walked
  const name = blockNameOf(anyNode, holder)
  if (name !== undefined && !seen.has(node) && patterns.some(p => matchesPattern(node, name, p))) {
    out.push(node)
    seen.add(node)
  }
  if (anyNode.content !== undefined) {
    // a folded section is a wrapper the tree adds around a heading and its text;
    // the text stands where it was written
    const inner = anyNode.type === 'block' && anyNode.name === '_folded_section' ? holder : anyNode
    collectMatches(anyNode.content as PodNode, inner, patterns, seen, out)
  }
}

// Normalize a path for loose suffix comparison:
//   'src/foo.podlite'      ~= 'foo.podlite'
//   './includes/x.podlite' ~= 'includes/x.podlite'
const normalizePath = (p: string): string => p.replace(/\\/g, '/').replace(/^\.\//, '')

const isGlobPattern = (s: string): boolean => /[*?[]/.test(s)

// Convert a glob pattern to an anchored RegExp.
//   **/   →  (?:.*/)?   zero or more directory segments (lets **/foo match root-level foo)
//   **    →  .*         any characters, crosses /
//   *     →  [^/]*      any characters within a single segment
//   ?     →  [^/]       single character within a segment
// Other regex meta characters are escaped.
const globRegexCache = new Map<string, RegExp>()
const globToRegex = (glob: string): RegExp => {
  const cached = globRegexCache.get(glob)
  if (cached) return cached
  let re = ''
  let i = 0
  while (i < glob.length) {
    const c = glob[i]
    const next = glob[i + 1]
    if (c === '*' && next === '*' && glob[i + 2] === '/') {
      re += '(?:.*/)?'
      i += 3
    } else if (c === '*' && next === '*') {
      re += '.*'
      i += 2
    } else if (c === '*') {
      re += '[^/]*'
      i += 1
    } else if (c === '?') {
      re += '[^/]'
      i += 1
    } else if (/[\\^$.()+|{}[\]]/.test(c)) {
      re += '\\' + c
      i += 1
    } else {
      re += c
      i += 1
    }
  }
  const compiled = new RegExp(`^${re}$`)
  globRegexCache.set(glob, compiled)
  return compiled
}

export const filePathMatches = (docFile: string, target: string): boolean => {
  const a = normalizePath(docFile)
  const b = normalizePath(target)

  if (isGlobPattern(b)) {
    const rx = globToRegex(b)
    if (rx.test(a)) return true
    // Suffix-tolerant match: allow any parent prefix (consistent with
    // non-glob suffix matching, so 'src/00-foo/x.pod' matches '00-foo/x.pod').
    const body = rx.source.slice(1, -1)
    const rxSuffix = new RegExp(`^(?:.*/)${body}$`)
    return rxSuffix.test(a)
  }

  return a === b || a.endsWith('/' + b) || b.endsWith('/' + a)
}

const getDocIDs = (doc: SelectorDoc): string[] => {
  const ids: string[] = []
  getFromTree(doc.node, 'NAME', 'TITLE').forEach(block => {
    const conf = makeAttrs(block, {})
    const title = getTextContentFromNode(block).trim()

    if (conf.exists('id')) {
      const id = conf.getFirstValue('id')
      if (id) ids.push(id)
    }
    ids.push(title)
  })
  return ids
}

function getMapIDsBlocks<T extends PodNode>(srcNode: T): Map<string, T> {
  const idsMap = new Map<string, T>()
  getFromTree(srcNode, { type: 'block' }).forEach(i => {
    const id = getNodeId(i, {})
    if (id) idsMap.set(id, i as T)
  })
  return idsMap
}

export const runSelector = <T extends SelectorDoc>(selector: string, docs: T[]): T[] | PodNode[] => {
  const parsed = parseSelector(selector)
  if (!parsed) return []

  const { scheme, document, anchor, patterns } = parsed

  let matchedDocs: T[] = docs
  if (scheme === 'doc' && document) {
    matchedDocs = docs.filter(doc => getDocIDs(doc).includes(document))
  } else if (scheme === 'file' && document) {
    matchedDocs = docs.filter(doc => filePathMatches(doc.file, document))
  } else if (scheme && scheme !== 'doc' && scheme !== 'file') {
    return []
  }

  // Anchor takes precedence — single-block-by-id lookup
  if (anchor) {
    const collectedBlocks: PodNode[] = []
    for (const d of matchedDocs) {
      const idsMap = getMapIDsBlocks(d.node)
      const block = idsMap.get(anchor)
      if (block) collectedBlocks.push(block)
    }
    return collectedBlocks
  }

  // Patterns — source-order traversal, apply each pattern, dedupe across patterns
  if (patterns.length > 0) {
    const collectedBlocks: PodNode[] = []
    const seen = new Set<PodNode>()
    for (const d of matchedDocs) {
      collectMatches(d.node, undefined, patterns, seen, collectedBlocks)
    }
    return collectedBlocks
  }

  // No anchor, no patterns — return whole docs
  return matchedDocs.map(d => d.node)
}
