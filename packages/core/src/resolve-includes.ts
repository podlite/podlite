import * as fs from 'fs'
import * as path from 'path'
import { getTextContentFromNode, parseSelector, runSelector, SelectorDoc, PodNode } from '@podlite/schema'

export type ResolveIncludesOptions = {
  baseDir: string
  parse: (source: string) => any
}

const isIncludeBlock = (node: any): boolean =>
  node && typeof node === 'object' && node.type === 'block' && node.name === 'include'

const keepBlocks = (items: Array<SelectorDoc | PodNode>): PodNode[] =>
  items.filter(item => item && typeof item === 'object' && !('file' in item)) as PodNode[]

const unwrapRoot = (blocks: PodNode[]): PodNode[] =>
  blocks.flatMap((b: any) =>
    b && b.type === 'block' && b.name === 'root' && Array.isArray(b.content) ? b.content : [b],
  )

export const resolveIncludes = (tree: any, opts: ResolveIncludesOptions): any => {
  const walkList = (list: any[], baseDir: string, stack: string[]): any[] =>
    list.flatMap(n => walkNode(n, baseDir, stack))

  const walkNode = (node: any, baseDir: string, stack: string[]): any => {
    if (!node || typeof node !== 'object') return node

    if (isIncludeBlock(node)) {
      const selector = getTextContentFromNode(node.content)?.toString().trim()
      const parsed = selector ? parseSelector(selector) : undefined
      if (!selector || !parsed || parsed.scheme !== 'file' || !parsed.document) return node

      const target = path.resolve(baseDir, parsed.document)
      if (stack.includes(target)) return []
      if (!fs.existsSync(target)) {
        throw new Error(`include target not found: ${parsed.document}`)
      }

      const subTree = walkNode(opts.parse(fs.readFileSync(target, 'utf-8')), path.dirname(target), [...stack, target])
      return unwrapRoot(keepBlocks(runSelector(selector, [{ file: parsed.document, node: subTree }])))
    }

    if (Array.isArray(node.content)) return { ...node, content: walkList(node.content, baseDir, stack) }
    return node
  }

  return walkNode(tree, opts.baseDir, [])
}
