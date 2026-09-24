import { ConfigItem } from './types'
import { isSetTransparent } from './set-assign'

const isBlock = (node: any): boolean => node && typeof node === 'object' && node.type === 'block'

const isInclude = (node: any): boolean => isBlock(node) && node.name === 'include'

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
    // the target is chosen in the content the include resolves to
    if (pending.length && isInclude(next)) {
      next = { ...next, set: pending.map(c => ({ ...c, from: 'set' as const })) }
      pending = []
    }
    if (pending.length && isBlock(next) && !isSetTransparent(next)) {
      const own = new Set((next.config || []).map((c: any) => c && c.name))
      const additions = pending.filter(c => !own.has(c.name)).map(c => ({ ...c, from: 'set' as const }))
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
