import { ConfigItem, PodNode, PodliteDocument } from '../types'

type ConfigMap = Record<string, ConfigItem[]>

const mergeDefaults = (own: ConfigItem[] | undefined, defaults: ConfigItem[]): ConfigItem[] => {
  const ownArr = Array.isArray(own) ? own : []
  const seen = new Set(ownArr.map(c => c && c.name).filter(Boolean))
  const additions = defaults.filter(c => c && c.name && !seen.has(c.name))
  if (additions.length === 0) return ownArr
  return [...ownArr, ...additions]
}

const lookupKeys = (node: { name?: string; level?: string | number }): string[] => {
  const keys: string[] = []
  if (typeof node.name !== 'string') return keys
  if (node.name === 'head' && node.level !== undefined && node.level !== null) {
    keys.push(`head${node.level}`)
  }
  if (node.name === 'item' && node.level !== undefined && node.level !== null) {
    keys.push(`item${node.level}`)
  }
  keys.push(node.name)
  return keys
}

const walk = (node: PodNode, config: ConfigMap): void => {
  if (Array.isArray(node)) {
    for (const child of node) walk(child as PodNode, config)
    return
  }
  if (!node || typeof node !== 'object') return
  const anyNode = node as {
    type?: string
    name?: string
    level?: string | number
    config?: ConfigItem[]
    content?: unknown
  }
  if (anyNode.type === 'config' && typeof anyNode.name === 'string' && Array.isArray(anyNode.config)) {
    config[anyNode.name] = anyNode.config
  } else if (anyNode.type === 'block') {
    for (const key of lookupKeys(anyNode)) {
      const defaults = config[key]
      if (defaults && defaults.length) {
        anyNode.config = mergeDefaults(anyNode.config, defaults)
      }
    }
  }
  if (anyNode.content !== undefined) {
    walk(anyNode.content as PodNode, config)
  }
}

export const propagateConfigDefaults = <T extends PodliteDocument | PodNode>(ast: T): T => {
  walk(ast as PodNode, {})
  return ast
}

export default propagateConfigDefaults
