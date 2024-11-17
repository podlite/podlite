import { getFromTree, getTextContentFromNode, makeAttrs, makeInterator } from '@podlite/schema'
import { BUILT_PATH, INDEX_PATH, POSTS_PATH, PUBLIC_PATH } from './constants'
import * as fs from 'fs'
import { PodliteWebPlugin, PodliteWebPluginContext, publishRecord, streamWriteArray } from '.'
import pathFs from 'path'
export interface SiteInfo {
  redirects: { source: string; destination: string; statusCode: number }[]
  postsPerPage: number
  favicon: string
  url: string
  node: any
  title: string
  globalStyles: string
  footer: string
  gtmId: string
  item: publishRecord
  templateFile?: string
}
interface siteDataPluginInitParams {
  public_path: string
  indexFilePath: string // file path to index file
  built_path: string // built path
  site_url?: string
}
const plugin = ({
  public_path = PUBLIC_PATH,
  indexFilePath = `${POSTS_PATH}/${INDEX_PATH}`,
  built_path = BUILT_PATH,
  site_url,
}: siteDataPluginInitParams): PodliteWebPlugin => {
  let indexPage
  let redirects: SiteInfo['redirects'] = []
  let allRecords: publishRecord[] = []

  const outCtx: PodliteWebPluginContext = {}
  const onExit = ctx => {
    let title
    let subtitle
    let author
    let footer = ''
    // collect site metadata like TITLE, SUBTITLE and attributes from pod
    const [pod] = getFromTree(indexPage.node, 'pod')
    const attr = makeAttrs(pod, {})
    const pageAttr = Object.fromEntries(Object.keys(attr.asHash()).map(k => [k, attr.getFirstValue(k)]))
    const { postsPerPage, favicon, puburl, url, globalStyles, gtmId, templateFile } = pageAttr

    // process favicon file

    const faviconPath = favicon ? pathFs.join(pathFs.dirname(indexFilePath), favicon) : 'src/favicon.png'
    const { base, ext } = pathFs.parse(faviconPath)
    const faviconFileName = `favicon${ext}`
    if (!ctx.testing) {
      fs.copyFileSync(faviconPath, `${public_path}/${faviconFileName}`)
    }
    //clean up index page and collect needed data

    const pageNode = makeInterator({
      TITLE: (node, ctx, interator) => {
        title = getTextContentFromNode(node)
      },
      SUBTITLE: (node, ctx, interator) => {
        subtitle = getTextContentFromNode(node)
      },
      AUTHOR: (node, ctx, interator) => {
        const attr = makeAttrs(node, ctx)
        author = Object.fromEntries(Object.keys(attr.asHash()).map(k => [k, attr.getFirstValue(k)]))
      },
      FOOTER: (node, ctx, interator) => {
        footer = node.content
      },
    })(indexPage.node, {})

    const siteData: SiteInfo = {
      postsPerPage,
      favicon: faviconFileName,
      url: site_url || process.env.SITE_URL || url || puburl,
      node: pageNode,
      title,
      globalStyles,
      redirects,
      footer,
      gtmId,
      ...(templateFile && { templateFile }),
      item: { ...indexPage, node: pageNode },
    }
    // !!! now get previsuly prepared data from context and prepare control.json
    const { stateVersion, nextPublishTime, imagesMap } = ctx
    const controlJson = {
      stateVersion,
      nextPublishTime,
    }
    if (!ctx.testing) {
      // save control.json
      fs.writeFileSync(`${public_path}/control.json`, JSON.stringify(controlJson, null, 2))
    }
    const dataJson = {
      all: [],
      control: controlJson,
      imagesMap: imagesMap?.size ? Object.fromEntries(imagesMap) : {},
      siteInfo: siteData,
    }

    if (!ctx.testing) {
      streamWriteArray(allRecords, `${built_path}/pages.json`)
        .then(() => console.log('All pages written successfully'))
        .catch(err => console.error('Error writing file:', err))
      fs.writeFileSync(`${built_path}/data.json`, JSON.stringify(dataJson))

      fs.writeFileSync(`${built_path}/siteInfo.json`, JSON.stringify(siteData, null, 2))

      fs.writeFileSync(`${built_path}/imagesMap.json`, JSON.stringify(imagesMap, null, 2))
    }

    // prepare data for LastArticles component
    if (!ctx.testing) {
      const source = () => allRecords.filter(i => i.publishUrl).filter(({ type = '' }: any) => type !== 'page')
      const articles = source().reverse().slice(0, 10)
      // if (!articles[articles.length - 1]) {
      //     throw new Error('No articles found' + JSON.stringify({'articles.length - 1':articles.length - 1, articles, 'allRecords':allRecords.length}, null, 2))
      // }
      // const lastArticleUrl = articles[articles.length - 1].publishUrl
      // const articleIndex = source().findIndex(({ publishUrl }) => publishUrl === lastArticleUrl)
      // const prev = source()[articleIndex - 1]

      fs.writeFileSync(`${built_path}/lastArticles.json`, JSON.stringify({ articles, prev: {} }, null, 2))
    }

    // process GlobalStyles
    let stylesContent = ''
    if (siteData.globalStyles) {
      const pathFs = require('path')
      const docDirPath = pathFs.dirname(`${built_path}/styles.css`)
      const path = pathFs.relative(docDirPath, pathFs.join(pathFs.dirname(indexFilePath), siteData.globalStyles))
      stylesContent += `
            @import '${path}';
        `
    } else {
      const path = '@Styles/default'
      stylesContent += `
            @import '${path}';
        `
    }
    if (!ctx.testing) {
      // /built/styles.css
      fs.writeFileSync(`${built_path}/styles.css`, stylesContent, 'utf8')
    }
    return { ...ctx, ...outCtx, siteData }
  }
  const onProcess = (recs: publishRecord[]) => {
    // collect redirects

    recs.map(item => {
      const { publishUrl, sources } = item
      sources.forEach(src => {
        redirects.push({ source: src, destination: publishUrl, statusCode: 308 }) //permanent redirect
      })
    })

    // get index page or throw error

    indexPage = recs.find(item => item.file === indexFilePath)
    if (!indexPage) {
      console.log(
        JSON.stringify(
          recs.map(i => i.file),
          null,
          2,
        ),
      )
      throw new Error('Index page not found. Used path: ' + indexFilePath)
    }
    indexPage.publishUrl = '/'
    allRecords.push(...recs)
    return recs
  }

  return [onProcess, onExit]
}

export default plugin
