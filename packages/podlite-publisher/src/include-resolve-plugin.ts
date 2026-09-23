import { getFromTree, getNodeId, getTextContentFromNode, makeAttrs, makeInterator, PodNode } from '@podlite/schema'
import { publishRecord } from './record'
import { PodliteWebPlugin, PodliteWebPluginContext } from './plugins'
import { outermost, SelectorError } from '@podlite/schema'
import { runSelector } from './shared'

// A selector whose operand does not resolve brings nothing in, and says so.
const select = (selector: string, recs: publishRecord[]) => {
  try {
    return runSelector(selector, recs)
  } catch (e) {
    if (!(e instanceof SelectorError)) throw e
    console.warn(`[plugin: resolve ] selector ${selector} cannot be read: ${e.message}`)
    return []
  }
}
const plugin = (): PodliteWebPlugin => {
  const outCtx: PodliteWebPluginContext = {}
  const docsMap = new Map()
  const onExit = ctx => ({ ...ctx, ...outCtx })
  const processNode = (node: PodNode, recs: publishRecord[]) => {
    const rules = {
      // TODO: remove 'Include' due to duplicate to 'include'
      Include: node => {
        const { content } = node
        const selector = getTextContentFromNode(content).trim()
        console.warn(`[include] start resolve selector: ${selector}`)
        if (selector) {
          // try to resolve selector
          const [block] = select(selector, recs)
          if (typeof block === 'object' && !('file' in block)) {
            const updated = { content: block }
            return { ...node, ...updated }
          }
          if (!block) {
            console.warn(`[plugin: resolve ] selector ${selector} not found`)
          }
        }
        return node
      },
      include: node => {
        const { content } = node
        const selector = getTextContentFromNode(content).trim()
        console.warn(`[include] start resolve selector: ${selector}`)
        if (selector) {
          const result = select(selector, recs)
          const blocks: PodNode[] = []
          for (const item of result) {
            if (typeof item === 'object' && item !== null && !('file' in item)) {
              blocks.push(item as PodNode)
            }
          }
          if (blocks.length > 0) {
            return { ...node, content: outermost(blocks) }
          }
          console.warn(`[plugin: resolve ] selector ${selector} not found`)
        }
        return node
      },
    }
    return makeInterator(rules)(node, {})
  }
  const onProcess = (recs: publishRecord[]) => {
    // convert all doc: links to file:: links
    const docsWithIncludesResolves = recs.map(item => {
      const node = processNode(item.node, recs)
      //   const node = item.node
      return { ...item, node }
    })

    return docsWithIncludesResolves
  }

  return [onProcess, onExit]
}
export default plugin
