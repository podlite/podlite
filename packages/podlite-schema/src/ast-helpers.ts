import { getTextContentFromNode } from '.'
import makeAttrsPod from './helpers/config'

export const getNodeId = (node, ctx) => {
  const conf = makeAttrsPod(node, ctx)
  if (conf.exists('id')) {
    return conf.getFirstValue('id')
  }
  return node.id
}
export const makeAttrs = makeAttrsPod
