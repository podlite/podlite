import {
  getFromTree,
  getNodeId,
  getTextContentFromNode,
  makeAttrs,
  makeInterator,
  PodliteDocument,
  PodNode,
} from '@podlite/schema'
import { publishRecord, pubRecord } from '.'
import { podlite as podlite_core } from 'podlite'
// now we add base60 letters

import translit from 'iso_9'
import base60 from 'newbase60'

export const getLangFromFilename = (filename?: string) => {
  if (!filename) return
  const ext = filename.split('.').pop()
  return defaultLangForFile[`.${ext}`]
}

export const defaultLangForFile = {
  '.rakudoc': 'raku',
  '.pl': 'perl',
  '.pm': 'perl',
  '.rakumod': 'raku',
}

export const makeAstFromSrc = (src: string) => {
  let podlite = podlite_core({ importPlugins: true }).use({})
  let tree = podlite.parse(src)
  const asAst = podlite.toAstResult(tree).interator as PodliteDocument
  return asAst
}

export function isExistsDocBlocks(node: PodNode) {
  let isExistsDocBlocks = false
  const markAsDocBlock = (node, ctx, interator) => {
    // skip root block
    if (node.type === 'block' && node.name === 'root') {
      if (node.content) {
        return interator(node.content, ctx)
      }
      return
    }
    isExistsDocBlocks = true
  }
  const rules = {
    ':para': markAsDocBlock,
    ':block': markAsDocBlock,
  }
  makeInterator(rules)(node, {})
  return isExistsDocBlocks
}

export function isExistsPubdate(node: PodNode) {
  let isShouldBePublished = false
  const rules = {
    ':block': (node, ctx, interator) => {
      const config = makeAttrs(node, ctx)
      if (config.exists('pubdate')) {
        isShouldBePublished = true
        return
      }
      if (Array.isArray(node.content)) {
        interator(node.content)
      }
    },
  }
  const transformer = makeInterator(rules)
  const res = transformer(node, {})
  return isShouldBePublished
}

export function getAllArticles(array) {
  let articles: Omit<pubRecord, 'file'>[] = []
  const getArticles = array => {
    // collect alias
    const aliases = array.filter(i => i.type == 'alias')
    // at first collect all levels
    const levels = array.filter(node => node.level && node.name === 'head') || []
    const nodesWithPubdate = levels.filter(node => {
      return makeAttrs(node, {}).exists('pubdate')
    })
    if (nodesWithPubdate.length > 0) {
      const nodePublished = nodesWithPubdate[0]
      // get next header with same level
      const nextHeader = levels
        .slice(levels.indexOf(nodePublished) + 1) // ignore this and previous nodes
        .filter(node => node.level <= nodePublished.level) // stop then found the same or lower level
        .shift()

      let lastIndexOfArticleNode = !nextHeader ? array.length : array.indexOf(nextHeader)
      const articleContent = array.slice(array.indexOf(nodePublished) + 1, lastIndexOfArticleNode)
      if (articleContent.length) {
        const description = getFromTree(articleContent, 'para')[0]
        const pubdate = makeAttrs(nodePublished, {}).getFirstValue('pubdate')
        articles.push({
          pubdate,
          type: 'page',
          node: articleContent,
          description,
        })
      }
    }
    array.forEach(node => {
      if (Array.isArray(node.content)) {
        getArticles(node.content)
      }
    })
  }
  getArticles(array)
  return articles
}
export const addUrl = (items: publishRecord[]) => {
  const withSxd: (publishRecord & {
    number?: number
    sxd: string
    sequence?: number
    slug?: string
  })[] = items.map(i => {
    const { file: f } = i
    const attrs = i
    const pubDate = new Date(i.pubdate)
    const sxd = base60.DateToSxg(pubDate)
    const type = i.type === 'note' ? 'n' : 'a'
    // make short name from title
    let words: string[] = (attrs.title || '').split(/\s/)
    let res = []
    while ([...res, words[0]].join(' ').length < 120) {
      //@ts-ignore
      res.push(words.shift())
    }
    let shortTitle = res.join(' ')
    // translit only cyrillic
    const translit2 = /[а-яА-ЯЁё]/.test(shortTitle) ? translit(shortTitle, 5) : shortTitle
    // make url clean
    const slug = ((translit2.replace(/`/, '') || '').replace(/\W+/g, '-') || '')
      .replace(/(^[-]+|[-]+$)/g, '')
      .toLowerCase()

    return { ...attrs, type, sxd, slug, file: f }
  })

  // get count of each type on corresponding date
  withSxd.reduce((acc, item) => {
    const { sxd, type } = item
    acc[sxd] = acc[sxd] || {}
    acc[sxd][type] = acc[sxd][type] || 0
    acc[sxd][type]++
    item.number = acc[sxd][type]
    return acc
  }, {})
  // sequence -  index of record at all in that day
  withSxd.reduce((acc, item) => {
    const { sxd } = item
    acc[sxd] = acc[sxd] || 0
    acc[sxd]++
    item.sequence = acc[sxd]
    return acc
  }, {})

  return withSxd.map(item => {
    const { type, number, sxd, slug, pubdate, sequence } = item
    const shortUrl = `/${type}${sxd}${number}`
    // /2019/12/34/a1/WriteAt-my-opensource-startup-on-Perl-6-Pod
    const date = new Date(pubdate)
    const month = date.getMonth() + 1
    const year = date.getFullYear()
    const day = date.getDate()
    // !!!!! publishUrl may exists
    const publishUrl = `/${year}/${month}/${day}/${sequence}/${slug}`.replace(/\/$/, '')
    const sources = [
      shortUrl,
      // `/${year}/${month}/${day}/${sequence}`,
    ]
    return { ...item, shortUrl, publishUrl, sources }
  })
}

///  Support for Selectors

type ParsedSelector = {
  scheme?: string
  document?: string
  anchor?: string
  blockFilters: string[]
}

// Selector grammar (spec §Selectors):
//   SELECTOR := [EXTERNAL_SOURCE '|'] BLOCKS_SELECTOR?
//   EXTERNAL_SOURCE := scheme:path[#anchor]
//   BLOCKS_SELECTOR := blockname (',' blockname)*
const parseSelector = (selector: string): ParsedSelector | undefined => {
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
    // Filters-only selector (current document scope — source-less)
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
const getDocIDs = (doc: publishRecord): string[] => {
  const ids = []
  //   for (const item of [doc]) {
  getFromTree(doc.node, 'NAME', 'TITLE').map(block => {
    const conf = makeAttrs(block, {})
    const title = getTextContentFromNode(block).trim()

    if (conf.exists('id')) {
      const id = conf.getFirstValue('id')
      if (id) {
        ids.push(id)
      }
    }
    ids.push(title)
  })
  return ids
}

function getMapIDsBlocks<T extends PodNode>(srcNode: T): Map<string, T> {
  const ids = []
  const idsMap = new Map<string, T>()
  const t = getFromTree(srcNode, { type: 'block' }).map(i => {
    const id = getNodeId(i, {})
    if (id) {
      idsMap.set(id, i as T)
    }
  })
  return idsMap
}

export const runSelector = (selector: string, docs: publishRecord[]): publishRecord[] | PodNode[] => {
  const parsed = parseSelector(selector)
  if (!parsed) return []

  const { scheme, document, anchor, blockFilters } = parsed

  // Filter docs by source scheme
  let matchedDocs: publishRecord[] = docs
  if (scheme === 'doc' && document) {
    matchedDocs = docs.filter(doc => getDocIDs(doc).includes(document))
  } else if (scheme === 'file' && document) {
    matchedDocs = docs.filter(doc => filePathMatches(doc.file, document))
  } else if (scheme && scheme !== 'doc' && scheme !== 'file') {
    // Unknown scheme
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
