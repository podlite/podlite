import {BlockHead, getTextContentFromNode, makeTransformer} from "@podlite/schema"
import { ParserPlugin, Node, nPara , AST, nText, nVerbatim } from "@podlite/schema"
import { nanoid } from 'nanoid'
import { BlockPod, PodNode } from '@podlite/schema'

/**
 * Clean ids from tree 
 * @returns 
 */

export const cleanIds = (src = {skipChain: 0, podMode: 1}) =>( tree )=>{
    const transformerBlocks = makeTransformer({
      '*': (node, ctx, visiter) => {
          if ('id' in node) {
              if ( 'content' in node ) {
                  node.content = visiter(node.content, ctx)
              }
              const {id, ...rest} = node
          return { ...rest,  }
          }
          return node
      }
    })
    return transformerBlocks(tree,{})
  }

/**
 * Add set id to 'id' to each blocks
 */
export const frozenIds = (src = {skipChain: 0, podMode: 1}) =>( tree )=>{
    const transformerBlocks = makeTransformer({
      '*': (node, ctx, visiter) => {
          if ('id' in node) {
              if ( 'content' in node ) {
                  node.content = visiter(node.content, ctx)
              }
              const {id, ...rest} = node
            return { ...rest, id: 'id' }
          }
          return node
      }
    })
    return transformerBlocks(tree,{})
}
   

const middleware:ParserPlugin = () =>( tree )=>{
  
  const transformerBlocks = makeTransformer({
    '*': (node, ctx, visiter) => {
            const addIdField = (node:PodNode):PodNode => {
                if (typeof node === 'object' && 'type' in node && node.type =='block') {
                    if (node.name == 'caption') {
                        return node
                    } else if ( node.name == 'head') {
                        return { ...node, id: getTextContentFromNode(node).trim() } as BlockHead
                    } else {
                        return { ...node, id: nanoid() } as PodNode
                    }
                }
                return node
            }
            const processContent = (node:PodNode):PodNode => {
                if (typeof node === 'object' && 'content' in node ) {
                    return { ...node, content: visiter(node.content, ctx) }
                }
                return node
            }
            return processContent( addIdField(node) )
        }
  })
  return transformerBlocks(tree,{})
}
export default middleware

