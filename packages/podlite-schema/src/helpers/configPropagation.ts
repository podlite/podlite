import { ConfigItem, PodNode, PodliteDocument } from '../types'

export type ConfigScope = Record<string, ConfigItem[]>
type ConfigMap = ConfigScope

// the nearer declaration decides an option, the farther one fills in the rest
export const mergeConfigSettings = (
  nearer: ConfigItem[] | undefined,
  farther: ConfigItem[] | undefined,
): ConfigItem[] => {
  const near = Array.isArray(nearer) ? nearer : []
  const far = Array.isArray(farther) ? farther : []
  const seen = new Set(near.map(c => c && c.name).filter(Boolean))
  const rest = far.filter(c => c && c.name && !seen.has(c.name))
  return rest.length ? [...near, ...rest] : near
}

const mergeDefaults = (own: ConfigItem[] | undefined, defaults: ConfigItem[]): ConfigItem[] => {
  const ownArr = Array.isArray(own) ? own : []
  const seen = new Set(ownArr.map(c => c && c.name).filter(Boolean))
  const additions = defaults.filter(c => c && c.name && !seen.has(c.name)).map(c => ({ ...c, from: 'config' as const }))
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
    config[anyNode.name] = mergeConfigSettings(anyNode.config, config[anyNode.name])
  } else if (anyNode.type === 'block') {
    for (const key of lookupKeys(anyNode)) {
      const defaults = config[key]
      if (defaults && defaults.length) {
        anyNode.config = mergeDefaults(anyNode.config, defaults)
      }
    }
  }
  if (anyNode.content !== undefined) {
    // a block is a lexical scope: what is declared inside it stays inside
    walk(anyNode.content as PodNode, anyNode.type === 'block' ? { ...config } : config)
  }
}

export const propagateConfigDefaults = <T extends PodliteDocument | PodNode | unknown[]>(
  ast: T,
  inherited: ConfigScope = {},
): T => {
  walk(ast as PodNode, { ...inherited })
  return ast
}

export default propagateConfigDefaults
