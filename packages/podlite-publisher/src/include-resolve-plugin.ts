import { getFromTree, getNodeId, getTextContentFromNode, makeAttrs, makeInterator, PodNode } from '@podlite/schema'
import { publishRecord } from './record'
import { PodliteWebPlugin, PodliteWebPluginContext } from './plugins'
import { applySetToFirst, ConfigItem, outermost, SelectorError } from '@podlite/schema'
import { parseSelector, runSelector } from './shared'

// A selector whose source, address or operand does not resolve brings nothing
// in, and says so once, naming the =set assignments lost with it.
const select = (selector: string, recs: publishRecord[], lost = '') => {
  // a selector that is not read, or a scheme not resolved here, finds nothing
  // without saying why
  const parsed = parseSelector(selector)
  if (!parsed) {
    console.warn(`[plugin: resolve ] selector ${selector} cannot be read${lost}`)
    return null
  }
  if (parsed.scheme && parsed.scheme !== 'doc' && parsed.scheme !== 'file') {
    console.warn(`[plugin: resolve ] selector ${selector}: scheme ${parsed.scheme}: is not supported${lost}`)
    return null
  }
  try {
    return runSelector(selector, recs)
  } catch (e) {
    if (!(e instanceof SelectorError)) throw e
    console.warn(`[plugin: resolve ] selector ${selector} cannot be read: ${e.message}${lost}`)
    return null
  }
}

const names = (set: ConfigItem[]): string => set.map(c => c.name).join(', ')

// The =set assignments written before an include go to the first block it
// brings; once placed or lost, the directive no longer carries them. When the
// include brings no block they stay without a target: carrying them on to the
// next block is not done here, nor through an include inside what was brought.
const assignments = (node: any) => {
  const set: ConfigItem[] = node.set || []
  const { set: _, ...rest } = node
  const lost = set.length ? `; =set assignments not applied: ${names(set)}` : ''
  const place = (blocks: PodNode[]): PodNode[] => {
    if (!set.length) return blocks
    const applied = applySetToFirst(blocks, set, { mode: 'include' })
    if (applied.outcome !== 'block') {
      console.warn(`[plugin: resolve ] =set before =include has no target block: ${names(set)}`)
    }
    return applied.outcome === 'block' ? applied.nodes : blocks
  }
  return { node: rest, lost, place }
}
const plugin = (): PodliteWebPlugin => {
  const outCtx: PodliteWebPluginContext = {}
  const docsMap = new Map()
  const onExit = ctx => ({ ...ctx, ...outCtx })
  const processNode = (node: PodNode, recs: publishRecord[]) => {
    const rules = {
      // TODO: remove 'Include' due to duplicate to 'include'
      Include: written => {
        const { node, lost, place } = assignments(written)
        const { content } = node
        const selector = getTextContentFromNode(content).trim()
        console.warn(`[include] start resolve selector: ${selector}`)
        if (selector) {
          // try to resolve selector
          const result = select(selector, recs, lost)
          if (!result) return node
          const [block] = result
          if (typeof block === 'object' && !('file' in block)) {
            const updated = { content: place([block as PodNode])[0] }
            return { ...node, ...updated }
          }
          if (!block) {
            console.warn(`[plugin: resolve ] selector ${selector} not found`)
            place([])
          }
        }
        return node
      },
      include: written => {
        const { node, lost, place } = assignments(written)
        const { content } = node
        const selector = getTextContentFromNode(content).trim()
        console.warn(`[include] start resolve selector: ${selector}`)
        if (selector) {
          const result = select(selector, recs, lost)
          if (!result) return node
          const blocks: PodNode[] = []
          for (const item of result) {
            if (typeof item === 'object' && item !== null && !('file' in item)) {
              blocks.push(item as PodNode)
            }
          }
          if (blocks.length > 0) {
            return { ...node, content: place(outermost(blocks)) }
          }
          console.warn(`[plugin: resolve ] selector ${selector} not found`)
          place([])
        } else if (lost) {
          console.warn(`[plugin: resolve ] include selector cannot be read: (empty)${lost}`)
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
