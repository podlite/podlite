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
  // resolve from the node's own name so depth counts every hop; a per-instance
  // :fallback overrides the type-level entry for the first hop
  const own = makeAttrs(node).getFirstValue('fallback')
  const hasOwn = typeof own === 'string'
  if (!hasOwn && !map.has(node.name)) return null
  const effectiveMap = hasOwn && map.get(node.name) !== own ? new Map(map).set(node.name, own) : map
  let result
  try {
    result = resolveFallback(node.name, effectiveMap, { maxDepth: opts.maxDepth })
  } catch {
    return null
  }
  if (result.resolved === node.name) return null
  const config = [...(Array.isArray(node.config) ? node.config : []), ...provenance(node.name, result.chain)]
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
