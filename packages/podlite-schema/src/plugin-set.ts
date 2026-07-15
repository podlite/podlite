import { ConfigItem } from './types'

// Directives and =comment blocks pass =set attributes through to the next
// real block instead of consuming them.
const isTransparent = (node: any): boolean => {
  if (!node || typeof node !== 'object') return false
  if (node.type === 'set' || node.type === 'config' || node.type === 'alias' || node.type === 'blankline') return true
  if (node.type === 'block' && (node.name === 'comment' || node.name === 'boundary' || node.name === 'include'))
    return true
  return false
}

const isBlock = (node: any): boolean => node && typeof node === 'object' && node.type === 'block'

// Each content array is its own lexical scope: pending attributes never leak
// into or out of a nested block.
const applyInScope = (content: any[]): any[] => {
  let pending: ConfigItem[] = []
  const out: any[] = []
  for (const node of content) {
    if (node && typeof node === 'object' && node.type === 'set' && Array.isArray(node.config)) {
      for (const item of node.config) {
        if (!item || !item.name) continue
        pending = pending.filter(p => p.name !== item.name)
        pending.push(item)
      }
      continue
    }
    let next = node
    if (isBlock(node) && Array.isArray(node.content)) {
      next = { ...node, content: applyInScope(node.content) }
    }
    if (pending.length && isBlock(next) && !isTransparent(next)) {
      const own = new Set((next.config || []).map((c: any) => c && c.name))
      const additions = pending.filter(c => !own.has(c.name))
      if (additions.length) next = { ...next, config: [...(next.config || []), ...additions] }
      pending = []
    }
    out.push(next)
  }
  if (pending.length) {
    console.warn(`[set] =set directive has no target block in scope: ${pending.map(c => c.name).join(', ')}`)
  }
  return out
}

export default () => (tree: any) => {
  if (Array.isArray(tree)) return applyInScope(tree)
  if (tree && typeof tree === 'object' && Array.isArray(tree.content)) {
    return { ...tree, content: applyInScope(tree.content) }
  }
  return tree
}
