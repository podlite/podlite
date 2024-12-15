import { getFromTree, getNodeId, getTextContentFromNode, makeAttrs, makeInterator, PodNode } from '@podlite/schema'
import { PodliteWebPlugin, PodliteWebPluginContext, publishRecord, runSelector } from '.'

const plugin = (): PodliteWebPlugin => {
  const outCtx: PodliteWebPluginContext = {}
  const docsMap = new Map()
  const onExit = ctx => ({ ...ctx, ...outCtx })
  const processNode = (node: PodNode, recs: publishRecord[]) => {
    const rules = {
      Include: node => {
        const { content } = node
        const selector = getTextContentFromNode(content).trim()
        console.warn(`[include] start resolve selector: ${selector}`)
        if (selector) {
          // try to resolve selector
          const [block] = runSelector(selector, recs)
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
