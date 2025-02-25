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
  scheme: string
  document: string
  anchor?: string
}

const parseSelector = (selector: string): ParsedSelector => {
  // doc:File1#data1
  const docWithAnchorPattern = /^([^:]+):([^#]+)#(.+)$/
  // Try doc:name#anchor pattern first
  const anchorMatch = selector.match(docWithAnchorPattern)
  if (anchorMatch) {
    return {
      scheme: anchorMatch[1],
      document: anchorMatch[2],
      anchor: anchorMatch[3],
    }
  }
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
  const paresedSelector = parseSelector(selector)
  if (paresedSelector) {
    const { scheme, document, anchor } = paresedSelector
    const filters = []
    if (scheme === 'doc') {
      filters.push((doc: publishRecord) => {
        // console.log(`[incliude] `)
        return getDocIDs(doc).includes(document)
      })
    }
    // Return documents that successfully pass all the filters.
    const subdocs = docs.filter(item => !filters.some(fn => !fn(item)))
    console.warn(`[include] found ${subdocs.length} docs for ${document}`)
    if (anchor) {
      const collected_blocks = []
      for (const d of subdocs) {
        const idsMap = getMapIDsBlocks(d.node)
        const block = idsMap.get(anchor)
        if (block) {
          collected_blocks.push(block)
        }
      }
      console.warn(`[include] found ${collected_blocks.length} blocks for anchor: ${anchor}`)
      return collected_blocks
    }
  }
  console.log(`[include] no any blocks found for ${selector}`)
  return []
}
