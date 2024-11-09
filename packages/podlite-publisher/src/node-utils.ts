import {
  getFromTree,
  getTextContentFromNode,
  makeAttrs,
  makeInterator,
  mkRootBlock,
  PodliteDocument,
  PodNode,
  RootBlock,
  Text,
} from '@podlite/schema'
import * as fs from 'fs'
import path from 'path'
import { getAllArticles, isExistsPubdate, makeAstFromSrc } from './shared'
import { parseMd } from '@podlite/markdown'
import { podlite } from 'podlite'
import matter from 'gray-matter'
import { publishRecord, pubRecord } from '.'

const glob = require('glob')

export const getPathToOpen = (filepath, parentDocPath) => {
  const isRemoteReg = new RegExp(/^(https?|ftp):/)
  const isRemote = isRemoteReg.test(filepath)
  if (isRemote) {
    return { isRemote, path: filepath }
  }
  const path = require('path')
  const docDirPath = path.dirname(parentDocPath)
  return {
    isRemote,
    path: path.isAbsolute(filepath) ? filepath : path.normalize(path.join(docDirPath, filepath)),
  }
}

export const makeLinksMap = (records: publishRecord[]): { [link: string]: string } => {
  const linksMap = {
    ...Object.fromEntries(records.map(({ publishUrl = '', file }) => [getPathToOpen(file, './').path, publishUrl])),
  }
  return linksMap
}
export const convertFileLinksToUrl = (records: publishRecord[], additinalMap = {}): publishRecord[] => {
  const linksMap = { ...additinalMap, ...makeLinksMap(records) }
  const processed = records.map(item => {
    const converter = makeInterator({
      'L<>': (node, ctx, interator) => {
        const { content, meta } = node
        const link = meta ? meta : getTextContentFromNode(content)
        const r = link.match(/file:\s*(?<path>(.+))\s*$/)
        const convertFileToUrl = filePath => {
          const { isRemote, path } = getPathToOpen(filePath, item.file)
          return isRemote ? null : linksMap[path]
        }
        const newLink = r?.groups?.path ? convertFileToUrl(r.groups.path) : link
        const newContent: Text = {
          type: 'text',
          value: newLink,
        }
        const updated = meta ? { meta: newLink } : { content: newContent }

        return { ...node, ...updated }
      },
    })
    const res = converter(item.node, {})
    // process images inside description
    let extra = {} as { description?: PodNode; footer?: PodNode; header?: PodNode }

    // process item description  header and footer
    const { footer, header, description } = item
    if (description) {
      extra.description = converter(description, {})
    }
    if (footer) {
      extra.footer = converter(footer, {})
    }
    if (header) {
      extra.header = converter(header, {})
    }

    return { ...item, node: res, ...extra }
  })
  return processed
}

export function parseFiles(path: string) {
  let count = 0
  const allFiles = glob
    .sync(path)
    .map((f: any) => {
      count++
      const testData = fs.readFileSync(f).toString()
      const asAst = makeAstFromSrc(testData)
      // now check if tree contains block with :pubdate attribute
      // '* :pubdate'
      if (!isExistsPubdate(asAst)) {
        return
      }
      // extract notes

      const notes: pubRecord[] = getFromTree(asAst, 'para')
        .filter(n => makeAttrs(n, {}).exists('pubdate'))
        .map((n: PodNode) => {
          const a_pubdate = makeAttrs(n, {}).getFirstValue('pubdate')
          // Due to cover some cases whan new Date fail on safari, i.e.
          // new Date("2022-05-07 10:00:00").getFullYear() -> NaN
          // convert to ISO 8601 "2022-05-07 10:00:00" -> "2022-05-07T10:00:00"
          const pubdate = a_pubdate.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/)
            ? a_pubdate.replace(' ', 'T')
            : a_pubdate

          return {
            pubdate,
            type: 'note',
            node: n,
            description: n,
            file: f,
          }
        })

      const articles: pubRecord[] = getAllArticles([asAst]).map(({ ...all }) => ({ ...all, file: f }))
      // note get full posts
      const pages: pubRecord[] = getFromTree(asAst, 'pod')
        .filter(n => makeAttrs(n, {}).exists('pubdate'))
        .map((n: PodNode) => {
          const a_pubdate = makeAttrs(n, {}).getFirstValue('pubdate')
          // Due to cover some cases whan new Date fail on safari, i.e.
          // new Date("2022-05-07 10:00:00").getFullYear() -> NaN
          // convert to ISO 8601 "2022-05-07 10:00:00" -> "2022-05-07T10:00:00"
          const pubdate = a_pubdate.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/)
            ? a_pubdate.replace(' ', 'T')
            : a_pubdate
          return {
            pubdate,
            type: 'page',
            node: n,
            file: f,
          }
        })
      console.warn(` pages: ${pages.length} articles: ${articles.length}, notes: ${notes.length} from ${f}`)
      return [...pages, ...articles, ...notes].map(item => {
        return { ...item, file: f }
      })
    })
    .flat()
    .filter(Boolean)
  return allFiles as pubRecord[]
}
const PARSER_TYPES = {
  MARKDOWN: 'markdown' as const,
  PODLITE: 'podlite' as const,
  DEFAULT: 'default' as const,
  ERROR: 'error' as const,
}

const MIME_TYPES_EXTENSIONS = {
  'text/podlite': ['.podlite', '.pod6'] as const,
  'text/markdown': ['.md', '.markdown'] as const,
  'text/plain': ['.txt'] as const,
  'audio/mpeg': ['.mp3'] as const,
}
const PARSER_TYPE_MIME_TYPES: {
  [name in typeof PARSER_TYPES[keyof typeof PARSER_TYPES]]: MimeTypes[]
} = {
  [PARSER_TYPES.PODLITE]: ['text/podlite'],
  [PARSER_TYPES.MARKDOWN]: ['text/markdown'],
  [PARSER_TYPES.DEFAULT]: ['text/plain'],
  [PARSER_TYPES.ERROR]: ['audio/mpeg'],
}

type PartserTypes = typeof PARSER_TYPES[keyof typeof PARSER_TYPES]

type MimeTypes = keyof typeof MIME_TYPES_EXTENSIONS

export function getParserTypeforFile(filePath: string, mime?: MimeTypes): PartserTypes {
  // get parser type using PARSER_TYPE_MIME_TYPES
  if (mime) {
    for (const [key, value] of Object.entries(PARSER_TYPE_MIME_TYPES)) {
      if (value.includes(mime)) {
        return key as PartserTypes
      }
    }
    // if not found return default  TODO: possible change to error
    console.warn(`Mime type ${mime} not found, using default parser`)
    return PARSER_TYPES.DEFAULT
  }
  const ext = path.extname(filePath).toLowerCase()
  const parserTypeMap: { [key: string]: PartserTypes } = {
    '.md': PARSER_TYPES.MARKDOWN,
    '.markdown': PARSER_TYPES.MARKDOWN,
    '.podlite': PARSER_TYPES.PODLITE,
    '.rakudoc': PARSER_TYPES.PODLITE,
    '.pod6': PARSER_TYPES.PODLITE,
  }
  return parserTypeMap[ext] || PARSER_TYPES.DEFAULT
}

export function parseFile(filePath: string, fileContent?: string, mime?: MimeTypes) {
  // check extension of file and parse it deepnds on mime type

  const parser_type = getParserTypeforFile(filePath, mime)
  const typeToParserMap: { [key: string]: (src: string) => PodliteDocument } = {
    [PARSER_TYPES.PODLITE]: (src: string) => {
      const podlite_processor = podlite({ importPlugins: true }).use({})
      const tree = podlite_processor.parse(src, { skipChain: 0, podMode: 1 })
      return podlite_processor.toAstResult(tree).interator as PodliteDocument
    },
    //@ts-ignore TODO: fix this
    [PARSER_TYPES.MARKDOWN]: (src: string) => {
      const { content } = matter(src)
      return parseMd(content)
    },
    [PARSER_TYPES.DEFAULT]: (src: string) => {
      const podlite_processor = podlite({ importPlugins: true }).use({})
      const tree = podlite_processor.parse(src, { skipChain: 0, podMode: 0 })
      return podlite_processor.toAstResult(tree).interator as PodliteDocument
    },
  }
  const src = fileContent || fs.readFileSync(filePath).toString()
  return typeToParserMap[parser_type](src)
}
export function getDocumentAttributes(node: PodliteDocument) {
  // filling title
  let title = ''
  let description = ''
  let subtitle
  let author
  let footer = ''
  let header = null
  makeInterator({
    NAME: (node, ctx, interator) => {
      title = getTextContentFromNode(node)
    },
    TITLE: (node, ctx, interator) => {
      title = getTextContentFromNode(node)
    },
    DESCRIPTION: (node, ctx, interator) => {
      description = node.content
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
    HEADER: (node, ctx, interator) => {
      header = node.content
    },
  })(node, {})
  const props = {
    title,
    description,
    subtitle,
    author,
    footer,
    puburl: undefined,
    pubdate: undefined,
    ...(header && { header }),
  }
  const [podnode] = getFromTree(node.content, 'pod')
  if (podnode) {
    // prepare publishUrl
    const conf = makeAttrs(podnode, {})
    props.puburl = conf.exists('puburl')
      ? conf.getFirstValue('puburl')
      : // check old publishUrl attribute
      conf.exists('publishUrl')
      ? conf.getFirstValue('publishUrl')
      : undefined
    const a_pubdate = conf.getFirstValue('pubdate')
    // Due to cover some cases whan new Date fail on safari, i.e.
    // new Date("2022-05-07 10:00:00").getFullYear() -> NaN
    // convert to ISO 8601 "2022-05-07 10:00:00" -> "2022-05-07T10:00:00"
    props.pubdate = a_pubdate?.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/)
      ? a_pubdate.replace(' ', 'T')
      : a_pubdate
  }
  return props
}
export function getPublishAttributes(node: PodNode) {
  // filling title
  let title = ''
  let description = ''
  let subtitle
  let author
  let footer = ''
  makeInterator({
    NAME: (node, ctx, interator) => {
      title = getTextContentFromNode(node)
    },
    TITLE: (node, ctx, interator) => {
      title = getTextContentFromNode(node)
    },
    DESCRIPTION: (node, ctx, interator) => {
      description = node.content
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
  })(node, {})
  const props = {
    title,
    description,
    subtitle,
    author,
    footer,
    puburl: undefined,
    pubdate: undefined,
  }
  const podnode = node
  if (podnode) {
    // prepare publishUrl
    const conf = makeAttrs(podnode, {})
    props.puburl = conf.exists('puburl')
      ? conf.getFirstValue('puburl')
      : // check old publishUrl attribute
      conf.exists('publishUrl')
      ? conf.getFirstValue('publishUrl')
      : undefined
    const a_pubdate = conf.getFirstValue('pubdate')
    // Due to cover some cases whan new Date fail on safari, i.e.
    // new Date("2022-05-07 10:00:00").getFullYear() -> NaN
    // convert to ISO 8601 "2022-05-07 10:00:00" -> "2022-05-07T10:00:00"
    props.pubdate = a_pubdate?.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/)
      ? a_pubdate.replace(' ', 'T')
      : a_pubdate
  }
  return props
}

export function processFile(f: string, content?: string, mime?: MimeTypes) {
  const podlite_document = parseFile(f, content, mime)
  // now extract some extra meta inforamtion, like pubdate, puburl
  const attr = ((f, node) => {
    if (getParserTypeforFile(f, mime) === PARSER_TYPES.MARKDOWN) {
      // try to extract from markdown front matter
      const { data } = matter(content || fs.readFileSync(f).toString())
      return data
    } else {
      return getDocumentAttributes(podlite_document)
    }
  })(f, podlite_document)
  // prepare attributes
  const { title, description, subtitle, author, footer, puburl, pubdate, header } = attr
  return {
    type: 'page',
    title,
    description,
    subtitle,
    author,
    ...(header && { header }),
    footer,
    publishUrl: puburl || null,
    pubdate,
    file: f,
    sources: [],
    node: podlite_document,
  } as publishRecord
}
export function parseSources(path: string): publishRecord[] {
  let count = 0
  const allFiles = glob
    .sync(path)
    .map((f: any) => {
      count++
      return processFile(f)
    })
    .flat()
    .filter(Boolean)
  return allFiles as publishRecord[]
}

export function streamWriteArray(array: any[], outputPath) {
  return new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(outputPath)

    writeStream.write('[')

    const writeItem = index => {
      if (index >= array.length) {
        writeStream.write(']')
        writeStream.end()
        resolve(1)
        return
      }

      const item = array[index]
      const json = JSON.stringify(item)
      const data = index === 0 ? json : ',' + json

      if (writeStream.write(data)) {
        setImmediate(() => writeItem(index + 1))
      } else {
        writeStream.once('drain', () => writeItem(index + 1))
      }
    }

    writeItem(0)

    writeStream.on('error', reject)
  })
}
