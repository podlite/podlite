import {
  Plugin,
  getFromTree,
  getTextContentFromNode,
  mkTocItem,
  mkTocList,
  mkToc,
  TocList,
  Toc,
  getNodeId,
  Plugins,
  makeAttrs,
  isNamedBlock,
  mkFomattingCodeL,
  mkBlock,
  mkNode,
} from '@podlite/schema'
import { prepareDataForToc } from './helpers'
import { PodNode } from '@podlite/schema'
export const getContentForToc = (node: PodNode): string => {
  if (typeof node !== 'string' && 'type' in node) {
    if (node.type === 'block') {
      const conf = makeAttrs(node, {})
      if (isNamedBlock(node.name)) {
        const caption = ((conf, nodeName) => {
          if (conf.exists('caption')) {
            return conf.getFirstValue('caption')
          } else if (conf.exists('title')) {
            return conf.getFirstValue('title')
          } else {
            // try to find content child node
            const [captionNode] = getFromTree(node, 'caption')
            if (captionNode) {
              return getTextContentFromNode(captionNode)
            }
          }
          return `${nodeName} not have :caption`
        })(conf, node.name)
        return caption
      }
      if (node.name == 'image') {
        const caption = getTextContentFromNode(conf.getFirstValue('caption'))
        return caption || 'image not have caption'
      }
      if (node.name == 'table') {
        const caption = getTextContentFromNode(conf.getFirstValue('caption'))
        return caption || 'table not have :caption'
      }
      if (node.type === 'block' && node.name === 'item') {
        if (Array.isArray(node.content) && node.content.length > 0) {
          return getTextContentFromNode(node.content[0])
        }
      }
      const caption = ((conf, nodeName) => {
        if (conf.exists('caption')) {
          return getTextContentFromNode(conf.getFirstValue('caption'))
        } else if (conf.exists('title')) {
          return getTextContentFromNode(conf.getFirstValue('title'))
        } else {
          // try to find content child node
          const [captionNode] = getFromTree(node, 'caption')
          if (captionNode) {
            return getTextContentFromNode(captionNode)
          }
          return null
        }
      })(conf, node.name)
      if (caption) {
        return caption
      }
      return getTextContentFromNode(node)
    }
  }
  return 'Not supported toc element'
}
/* 


*/
export const plugin: Plugin = {
  toAstAfter: (writer, processor, fulltree) => {
    return (node, ctx) => {
      const content = getTextContentFromNode(node)
      const blocks: Array<any> = content
        .trim()
        .split(/(?:\s*,\s*|\s+)/)
        .filter(Boolean)
      if (blocks.length == 0) {
        blocks.push({ name: 'head' })
      }
      const nodes = getFromTree(fulltree, ...blocks)
      const tocTree = prepareDataForToc(nodes)
      const createList = (items: any[], level): TocList => {
        const resultList = []
        items.map(item => {
          const { level, node, content } = item
          // create new node for each item
          const text = getContentForToc(node) || ' ' // ' ' needs to avoid lack of L<>
          //TODO: 1. getNodeId should use ctx of node, but using {} instead
          //TODO: 2. refactor linking for blocks
          const para = mkNode({
            type: 'para',
            content: [mkFomattingCodeL({ meta: `#${getNodeId(node, {})}` }, [text])],
          }) as PodNode
          const tocNode = para
          resultList.push(mkTocItem(tocNode))
          if (Array.isArray(content) && content.length > 0) {
            resultList.push(createList(content, level + 1))
          }
        })
        return mkTocList(resultList, level)
      }
      const conf = makeAttrs(node, ctx)
      const tocTitle = conf.getFirstValue('caption') || conf.getFirstValue('title')
      const makeToc = (tocTree: any, title): Toc => {
        return mkToc(createList(tocTree.content, 1), title, node.location)
      }

      return makeToc(tocTree, tocTitle)
    }
  },
}
export const PluginRegister: Plugins = {
  Toc: plugin, //TODO: deprecate it
  toc: plugin,
}
export default plugin
