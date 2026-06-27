import { ConfigItem, PodNode } from './types'
import { makeAttrs } from './helpers/config'
import { collectFallbackMap, resolveFallback } from './fallback-resolver'

export type MaterializeOptions = {
  maxDepth?: number
}

const isCustomBlock = (node: any): boolean => {
  const name = node && node.name
  return node && node.type === 'block' && typeof name === 'string' && name !== name.toLowerCase()
}

const provenance = (originalName: string, chain: string[]): ConfigItem[] => [
  { name: 'original-name', value: originalName, type: 'string' },
  { name: 'resolved-via', value: chain, type: 'array' },
]

export const deriveFallbackNode = (node: any, map: Map<string, string>, opts: MaterializeOptions = {}): any | null => {
  if (!node || !isCustomBlock(node)) return null
  // a per-instance :fallback overrides the type-level map for the first hop;
  // propagateConfigDefaults has already merged the =config default onto the node
  const own = makeAttrs(node).getFirstValue('fallback')
  const start = typeof own === 'string' ? own : map.get(node.name)
  if (typeof start !== 'string') return null
  let result
  try {
    result = resolveFallback(start, map, { maxDepth: opts.maxDepth })
  } catch {
    return null
  }
  const chain = [node.name, ...result.chain]
  const config = [...(Array.isArray(node.config) ? node.config : []), ...provenance(node.name, chain)]
  return { ...node, name: result.resolved, config }
}

export const materializeFallback = <T>(ast: T, opts: MaterializeOptions = {}): T => {
  const map = collectFallbackMap(ast as unknown as PodNode)
  const walk = (node: any): any => {
    if (Array.isArray(node)) {
      let changed = false
      const mapped = node.map(child => {
        const next = walk(child)
        if (next !== child) changed = true
        return next
      })
      return changed ? mapped : node
    }
    if (!node || typeof node !== 'object') return node
    const derived = deriveFallbackNode(node, map, opts)
    const base = derived || node
    if (base.content !== undefined) {
      const content = walk(base.content)
      if (derived || content !== base.content) return { ...base, content }
      return node
    }
    return derived || node
  }
  return walk(ast)
}

export default materializeFallback
