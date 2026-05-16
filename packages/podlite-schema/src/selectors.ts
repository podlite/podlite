import { getFromTree, getNodeId, getTextContentFromNode, makeAttrs, PodliteDocument, PodNode } from './index'

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

export type ValueSpec = { kind: 'angle'; value: string } | { kind: 'contains'; value: string }

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

const isIdentStart = (c: string): boolean => /[a-zA-Z_]/.test(c)
const isIdentCont = (c: string): boolean => /[a-zA-Z0-9_-]/.test(c)

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
    return { modifier, attrName, valueSpec: { kind: 'contains', value: read.value } }
  }

  if (s[i] === '<') {
    const read = readAngleValue(s, i)
    if (!read || read.end !== s.length) return undefined
    return { modifier, attrName, valueSpec: { kind: 'angle', value: read.value } }
  }

  return undefined
}

// Split predicate body by whitespace at top level, respecting <...> nesting.
const splitConditions = (body: string): string[] | undefined => {
  const chunks: string[] = []
  let depth = 0
  let buf = ''
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (c === '<') depth++
    else if (c === '>') {
      if (depth === 0) return undefined
      depth--
    }
    if (depth === 0 && /\s/.test(c)) {
      if (buf) {
        chunks.push(buf)
        buf = ''
      }
      continue
    }
    buf += c
  }
  if (depth !== 0) return undefined
  if (buf) chunks.push(buf)
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

  if (s[i] !== '[' || s[s.length - 1] !== ']') return undefined
  const body = s.slice(i + 1, s.length - 1).trim()
  if (!body) return undefined

  const predicate = parsePredicate(body)
  if (!predicate) return undefined

  return { blockType, predicate }
}

// Split pattern-list by comma at top level, respecting [...] and <...> nesting.
const splitPatterns = (s: string): string[] | undefined => {
  const chunks: string[] = []
  let bracketDepth = 0
  let angleDepth = 0
  let buf = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '[') bracketDepth++
    else if (c === ']') {
      if (bracketDepth === 0) return undefined
      bracketDepth--
    } else if (c === '<') angleDepth++
    else if (c === '>') {
      if (angleDepth === 0) return undefined
      angleDepth--
    }
    if (c === ',' && bracketDepth === 0 && angleDepth === 0) {
      chunks.push(buf)
      buf = ''
      continue
    }
    buf += c
  }
  if (bracketDepth !== 0 || angleDepth !== 0) return undefined
  chunks.push(buf)
  return chunks
}

const parsePatternList = (filterPart: string): Pattern[] | undefined => {
  if (!filterPart) return []
  const chunks = splitPatterns(filterPart)
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

  // Split on the first '|' — left is source, right is pattern-list
  const pipeIdx = trimmed.indexOf('|')
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

  if (cond.valueSpec.kind === 'angle') {
    if (!exists) return false
    const equal = String(attrs.getFirstValue(cond.attrName)) === cond.valueSpec.value
    return cond.modifier === '!' ? !equal : equal
  }

  if (cond.valueSpec.kind === 'contains') {
    if (!exists) return false
    // Author-facing semantics: `:tags<a b c>` is a list of three elements.
    // Grammar parses unquoted identifier sequences as a single string, so
    // split string values on whitespace/comma to recover list shape.
    const tokens: string[] = []
    for (const v of attrs.getAllValues(cond.attrName) as unknown[]) {
      if (typeof v === 'string') {
        for (const t of v.split(/[\s,]+/)) if (t) tokens.push(t)
      } else {
        tokens.push(String(v))
      }
    }
    const present = tokens.includes(cond.valueSpec.value)
    return cond.modifier === '!' ? !present : present
  }

  return false
}

// Replicate name/level handling from getFromTree for backward compat with
// 'head1' / 'item' style block-types.
const blockTypeMatches = (node: PodNode, blockType: string): boolean => {
  if (blockType === '*') return true
  const anyNode = node as unknown as { name?: string; level?: number }
  if (anyNode.name === blockType) return true
  const m = blockType.match(/^(head|item)(\d+)?$/)
  if (m) {
    const [, baseName, levelStr] = m
    if (anyNode.name !== baseName) return false
    const expectedLevel = levelStr ? parseInt(levelStr, 10) : baseName === 'item' ? 1 : undefined
    if (expectedLevel === undefined) return true
    // Heading plugin stores level as the regex capture string; coerce.
    return Number(anyNode.level) === expectedLevel
  }
  return false
}

const matchesPattern = (node: PodNode, pattern: Pattern): boolean => {
  if (!blockTypeMatches(node, pattern.blockType)) return false
  if (!pattern.predicate) return true
  return pattern.predicate.every(c => matchCondition(node, c))
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

const filePathMatches = (docFile: string, target: string): boolean => {
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

  // Patterns — full-tree traversal, apply each pattern, dedupe across patterns
  if (patterns.length > 0) {
    const collectedBlocks: PodNode[] = []
    const seen = new Set<PodNode>()
    for (const d of matchedDocs) {
      const allBlocks = getFromTree(d.node, { type: 'block' })
      for (const block of allBlocks) {
        if (seen.has(block)) continue
        if (patterns.some(p => matchesPattern(block, p))) {
          collectedBlocks.push(block)
          seen.add(block)
        }
      }
    }
    return collectedBlocks
  }

  // No anchor, no patterns — return whole docs
  return matchedDocs.map(d => d.node)
}
