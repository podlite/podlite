import { ConfigItem, PodNode, PodliteDocument } from '../types'

const truthy = (v: unknown): boolean => v === true || v === 1 || v === '1' || v === 'true'

const isNumbered = (config: ConfigItem[] | undefined): boolean | null => {
  if (!Array.isArray(config)) return null
  let result: boolean | null = null
  for (const entry of config) {
    if (!entry || entry.name !== 'numbered') continue
    const value = entry.value
    if (value === false || value === 0 || value === '0' || value === 'false') {
      result = false
    } else {
      result = truthy(value) ? true : value !== undefined ? Boolean(value) : true
    }
  }
  return result
}

const allItemsNumbered = (listNode: { content?: unknown }): boolean => {
  if (!Array.isArray(listNode.content)) return false
  let hasAny = false
  for (const child of listNode.content) {
    const c = child as { type?: string; name?: string; config?: ConfigItem[] }
    if (!c || c.type !== 'block' || c.name !== 'item') continue
    hasAny = true
    if (isNumbered(c.config) !== true) return false
  }
  return hasAny
}

const walk = (node: PodNode): void => {
  if (Array.isArray(node)) {
    for (const child of node) walk(child as PodNode)
    return
  }
  if (!node || typeof node !== 'object') return
  const anyNode = node as {
    type?: string
    list?: string
    content?: unknown
  }
  if (anyNode.type === 'list' && anyNode.list === 'itemized' && allItemsNumbered(anyNode)) {
    anyNode.list = 'ordered'
  }
  if (anyNode.content !== undefined) {
    walk(anyNode.content as PodNode)
  }
}

export const promoteOrderedLists = <T extends PodliteDocument | PodNode>(ast: T): T => {
  walk(ast as PodNode)
  return ast
}

export default promoteOrderedLists
