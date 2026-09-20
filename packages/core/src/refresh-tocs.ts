import { markGuarded } from '@podlite/schema'
import { plugin as tocPlugin } from '@podlite/toc'
import { IncludeOrigin } from './resolve-includes'

const isTocBlock = (node: any): boolean =>
  node && typeof node === 'object' && node.type === 'block' && (node.name === 'toc' || node.name === 'Toc')

const collectTocBlocks = (tree: any, found: Map<number, any>): void => {
  if (!tree || typeof tree !== 'object') return
  if (Array.isArray(tree)) return tree.forEach(node => collectTocBlocks(node, found))
  if (isTocBlock(tree) && tree.location) found.set(tree.location.start.offset, tree)
  if (Array.isArray(tree.content)) tree.content.forEach((node: any) => collectTocBlocks(node, found))
}

// A table of contents is built while its file is parsed, before the includes of
// that file are in. Built again over the assembled document, it reaches the
// blocks they brought. Only the document's own tables are rebuilt: a table in an
// included file stays as its file built it.
export const refreshTocs = (
  tree: any,
  written: any,
  file: string,
  origin: WeakMap<object, IncludeOrigin>,
  // told of each copy, so a caller keeping its own table on the nodes can carry it
  onCopy?: (from: object, to: object) => void,
): any => {
  const blocks = new Map<number, any>()
  // a table hidden by its own :masked or by a hidden container keeps that mark here
  collectTocBlocks(markGuarded(written), blocks)
  if (blocks.size === 0) return tree
  const rebuild = tocPlugin.toAstAfter(null, null, tree)
  const walk = (node: any): any => {
    if (!node || typeof node !== 'object') return node
    if (Array.isArray(node)) return node.map(walk)
    const own = origin.get(node)?.file === file
    if (node.type === 'toc' && own && node.location && blocks.has(node.location.start.offset)) {
      return rebuild(blocks.get(node.location.start.offset), {}, (content: any) => content)
    }
    if (!Array.isArray(node.content)) return node
    const copy = { ...node, content: node.content.map(walk) }
    const known = origin.get(node)
    if (known) origin.set(copy, known)
    onCopy?.(node, copy)
    return copy
  }
  return walk(tree)
}
