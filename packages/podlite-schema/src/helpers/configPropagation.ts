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

// a block as the walk over settings meets it
export type ScopedBlock = {
  type?: string
  name?: string
  level?: string | number
  config?: ConfigItem[]
  content?: unknown
}

const walk = (node: PodNode, config: ConfigMap, visit: (block: ScopedBlock, scope: ConfigScope) => void): void => {
  if (Array.isArray(node)) {
    for (const child of node) walk(child as PodNode, config, visit)
    return
  }
  if (!node || typeof node !== 'object') return
  const anyNode = node as ScopedBlock
  if (anyNode.type === 'config' && typeof anyNode.name === 'string' && Array.isArray(anyNode.config)) {
    config[anyNode.name] = mergeConfigSettings(anyNode.config, config[anyNode.name])
  } else if (anyNode.type === 'block') {
    visit(anyNode, config)
  }
  if (anyNode.content !== undefined) {
    // a block is a lexical scope: what is declared inside it stays inside
    walk(anyNode.content as PodNode, anyNode.type === 'block' ? { ...config } : config, visit)
  }
}

const applyDefaults = (block: ScopedBlock, config: ConfigScope): void => {
  for (const key of lookupKeys(block)) {
    const defaults = config[key]
    if (defaults && defaults.length) {
      block.config = mergeDefaults(block.config, defaults)
    }
  }
}

/*
=begin pod :kind<export>

=head2 walkConfigScopes

Calls C<visit> for each block of a tree, in document order, with the C<=config>
settings in effect where the block stands: those handed in as C<inherited> and
those declared before the block in the blocks around it. A block is a scope: what
is declared inside it stays inside. The settings object is the walk's own and
changes as it goes on; a visitor that keeps it copies it. The content a visitor
gives a block is walked next, as the content of that block.

=end pod
*/
export const walkConfigScopes = (
  ast: PodliteDocument | PodNode | unknown[],
  inherited: ConfigScope,
  visit: (block: ScopedBlock, scope: ConfigScope) => void,
): void => walk(ast as PodNode, { ...inherited }, visit)

export const propagateConfigDefaults = <T extends PodliteDocument | PodNode | unknown[]>(
  ast: T,
  inherited: ConfigScope = {},
): T => {
  walk(ast as PodNode, { ...inherited }, applyDefaults)
  return ast
}

export default propagateConfigDefaults
