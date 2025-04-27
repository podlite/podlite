import { getTextContentFromNode } from '.'
import makeAttrsPod from './helpers/config'
import { Node } from './types'

export const getNodeId = (node, ctx) => {
  const conf = makeAttrsPod(node, ctx)
  if (conf.exists('id')) {
    return conf.getFirstValue('id')
  }
  return node.id
}
export const getSafeNodeId = (node: Node, ctx): string | null => getNodeId(node, ctx)?.toString().replace(/\s/g, '-')

export const makeAttrs = makeAttrsPod
