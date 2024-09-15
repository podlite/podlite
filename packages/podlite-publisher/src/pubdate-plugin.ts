import { publishRecord, PodliteWebPlugin, PodliteWebPluginContext } from '.'
import { getFromTree, getTextContentFromNode, makeAttrs, mkRootBlock, PodNode } from '@podlite/schema'
import { getPublishAttributes } from './node-utils'
import { addUrl } from './shared'

export interface PodliteWebPluginParams {
  [name: string]: any
}

export function getArticles(item: publishRecord) {
  let articles: publishRecord[] = []
  const { file } = item
  const _getArticles = array => {
    // // collect alias
    // const aliases = array.filter(i => i.type == 'alias')
    // at first collect all levels
    const levels = array.filter(node => node.level && node.name === 'head') || []

    const nodesWithPubdate = levels.filter(node => {
      return makeAttrs(node, {}).exists('pubdate')
    })
    if (nodesWithPubdate.length > 0) {
      for (const nodePublished of nodesWithPubdate) {
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
          //TODO: use footer and header of document for generated articles
          articles.push({
            pubdate,
            title: getTextContentFromNode(nodePublished).trim(),
            type: 'page',
            publishUrl: '',
            sources: [],
            node: mkRootBlock({}, articleContent),
            description,
            file,
          })
        }
      }
    }
    array.forEach(node => {
      if (Array.isArray(node.content)) {
        _getArticles(node.content)
      }
    })
  }
  if (typeof item.node !== 'string') {
    _getArticles(item.node.content)
  }
  return articles
}

export function getNotes(item: publishRecord): publishRecord[] {
  const { file } = item
  const notes = getFromTree(item.node, 'para')
    .filter(n => makeAttrs(n, {}).exists('pubdate'))
    .map((n: PodNode) => {
      const a_pubdate = makeAttrs(n, {}).getFirstValue('pubdate')
      // Due to cover some cases whan new Date fail on safari, i.e.
      // new Date("2022-05-07 10:00:00").getFullYear() -> NaN
      // convert to ISO 8601 "2022-05-07 10:00:00" -> "2022-05-07T10:00:00"
      const pubdate = a_pubdate.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/)
        ? a_pubdate.replace(' ', 'T')
        : a_pubdate
      //TODO: use footer and header of document for generated notes
      return {
        pubdate,
        type: 'note',
        title: null,
        node: mkRootBlock({}, [n]),
        description: n,
        file,
        publishUrl: '',
        sources: [],
      }
    })
  return notes
}

export function getPages(item: publishRecord): publishRecord[] {
  const { file, sources } = item
  const pages = getFromTree(item.node, 'pod')
    .filter(n => makeAttrs(n, {}).exists('pubdate'))
    .map((n: PodNode) => {
      const { title, description, puburl, pubdate } = getPublishAttributes(n)
      //TODO: use footer and header of document for generated pages
      return {
        pubdate: pubdate || '',
        type: 'page',
        title,
        node: mkRootBlock({}, [n]),
        description,
        file,
        publishUrl: puburl || '',
        sources,
      } as publishRecord
    })
  return pages
}
const plugin = (): PodliteWebPlugin => {
  const outCtx: PodliteWebPluginContext = {}
  const onExit = ctx => ({ ...ctx, ...outCtx })
  const onProcess = (recs: publishRecord[]) => {
    // extract articles and notes from documents
    const rects1 = recs.reduce((acc, item) => {
      const articles = getArticles(item)
      const notes = getNotes(item)
      const pages = getPages(item)
      return [...acc, ...articles, ...notes, ...pages]
    }, [] as publishRecord[])

    //filter items with pubdate and sort all by pubdate
    //@ts-ignore
    const allItemForPublish = rects1
      .filter(a => a.pubdate)
      .sort((a, b) => {
        //@ts-ignore
        return new Date(a.pubdate) - new Date(b.pubdate)
      })
    // now filter  out items for publish in future
    const isDateInFuture = dateString => {
      return new Date().getTime() < new Date(dateString).getTime()
    }
    // save additional info
    const nextPublishTime = (allItemForPublish.filter(a => isDateInFuture(a.pubdate))[0] || {}).pubdate
    outCtx.nextPublishTime = nextPublishTime
    // get not "pages" ( not have publishUrl)
    let notPages = allItemForPublish
      .filter(a => !a.publishUrl)
      .filter(a => !!a.pubdate)
      .filter(a => !isDateInFuture(a.pubdate))

    let Pages = allItemForPublish.filter(a => a.publishUrl).filter(a => !(a.pubdate && isDateInFuture(a.pubdate)))
    const notPagesWithPublishAttrs = addUrl(notPages)
    const allRecords = [...notPagesWithPublishAttrs, ...Pages]
    return allRecords
  }

  return [onProcess, onExit]
}

export default plugin
