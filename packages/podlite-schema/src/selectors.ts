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
SELECTOR := [EXTERNAL_SOURCE '|'] BLOCKS_SELECTOR?
EXTERNAL_SOURCE := scheme:path[#anchor]
BLOCKS_SELECTOR := blockname (',' blockname)*
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

export type ParsedSelector = {
  scheme?: string
  document?: string
  anchor?: string
  blockFilters: string[]
}

export const parseSelector = (selector: string): ParsedSelector | undefined => {
  const trimmed = selector.trim()
  if (!trimmed) return undefined

  // Split on the first '|' — left is source, right is blocks selector
  const pipeIdx = trimmed.indexOf('|')
  const sourcePart = (pipeIdx === -1 ? trimmed : trimmed.slice(0, pipeIdx)).trim()
  const filterPart = pipeIdx === -1 ? '' : trimmed.slice(pipeIdx + 1).trim()

  const blockFilters = filterPart
    ? filterPart
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    : []

  // Source: scheme:path or scheme:path#anchor
  const sourceMatch = sourcePart.match(/^([^:]+):([^#]+)(?:#(.+))?$/)
  if (sourceMatch) {
    return {
      scheme: sourceMatch[1],
      document: sourceMatch[2].trim(),
      anchor: sourceMatch[3],
      blockFilters,
    }
  }

  if (blockFilters.length > 0) {
    return { blockFilters }
  }

  return undefined
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

  const { scheme, document, anchor, blockFilters } = parsed

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

  // Block filters — extract blocks by name across matched docs
  if (blockFilters.length > 0) {
    const collectedBlocks: PodNode[] = []
    for (const d of matchedDocs) {
      for (const name of blockFilters) {
        collectedBlocks.push(...getFromTree(d.node, name))
      }
    }
    return collectedBlocks
  }

  // No anchor, no filter — return whole docs
  return matchedDocs.map(d => d.node)
}
