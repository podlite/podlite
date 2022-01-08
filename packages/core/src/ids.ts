import makeTransformer, {isNamedBlock} from 'pod6/built/helpers/makeTransformer'
import { Plugin, Node, nPara , AST, nText, nVerbatim } from 'pod6/built/'
import { nanoid } from 'nanoid'

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
   

const middleware:Plugin = () =>( tree )=>{
  
  const transformerBlocks = makeTransformer({
    '*': (node, ctx, visiter) => {
        if ('type' in node && node.type === 'block') {
            if ( 'content' in node ) {
                node.content = visiter(node.content, ctx)
            }
        return { ...node, id: nanoid() }
        }
        return node
    }
  })
  return transformerBlocks(tree,{})
}
export default middleware

