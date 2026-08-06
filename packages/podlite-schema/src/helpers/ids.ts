import { BlockHead, getTextContentFromNode, makeTransformer } from '..'
import { ParserPlugin } from '..'
import { nanoid } from 'nanoid'
import { PodNode } from '..'
import slugify from 'slugify'

/**
 * Clean ids from tree
 * @returns
 */

export const cleanIds =
  (src = { skipChain: 0, podMode: 1 }) =>
  tree => {
    const transformerBlocks = makeTransformer({
      '*': (node, ctx, visiter) => {
        if ('id' in node) {
          if ('content' in node) {
            node.content = visiter(node.content, ctx)
          }
          const { id, ...rest } = node
          return { ...rest }
        }
        return node
      },
    })
    return transformerBlocks(tree, {})
  }

// A heading carries its own text as the identifier. Shaping it for a particular
// output — collapsing separators, dropping punctuation, numbering repeats — is the
// exporter's job (see getSafeNodeId), not the parser's. Slugifying here also
// transliterated cyrillic, so «Приветствие Мир» became Privetstvie-Mir and the
// original name could not be recovered.
export const headingId = (text: string) => text.trim().replace(/\s+/g, ' ')

// kept for callers outside the tree layer
export const slugifyText = (text: string) => {
  return slugify(text.trim(), {})
}

/**
 * Add set id to 'id' to each blocks
 */
export const frozenIds =
  (src = { skipChain: 0, podMode: 1 }) =>
  tree => {
    const transformerBlocks = makeTransformer({
      '*': (node, ctx, visiter) => {
        if ('content' in node) {
          node.content = visiter(node.content, ctx)
        }
        if ('id' in node) {
          const { id, ...rest } = node
          return { ...rest, id: 'id' }
        }
        return node
      },
    })
    return transformerBlocks(tree, {})
  }

export const setAllLinksToAnchor =
  (src = { skipChain: 0, podMode: 1 }) =>
  tree => {
    const transformerBlocks = makeTransformer({
      'L<>': (node, ctx, visiter) => {
        if ('meta' in node) {
          if ('content' in node) {
            node.content = visiter(node.content, ctx)
          }
          const { id, ...rest } = node
          return { ...rest, meta: '#' }
        }
        return node
      },
    })
    return transformerBlocks(tree, {})
  }

const middleware: ParserPlugin = () => tree => {
  const transformerBlocks = makeTransformer({
    '*': (node, ctx, visiter) => {
      const addIdField = (node: PodNode): PodNode => {
        if (typeof node === 'object' && 'type' in node && node.type == 'block') {
          if (node.name == 'caption') {
            return node
          } else if (node.name == 'head') {
            return { ...node, id: headingId(getTextContentFromNode(node)) } as BlockHead
          } else {
            return { ...node, id: nanoid() } as PodNode
          }
        }
        return node
      }
      const processContent = (node: PodNode): PodNode => {
        if (typeof node === 'object' && 'content' in node) {
          return { ...node, content: visiter(node.content, ctx) }
        }
        return node
      }
      return processContent(addIdField(node))
    },
  })
  return transformerBlocks(tree, {})
}
export default middleware
