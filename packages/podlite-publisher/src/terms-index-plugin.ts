import { PodliteWebPlugin, PodliteWebPluginContext, publishRecord } from '../src'
import {
  content,
  emptyContent,
  FormattingCodeX,
  getTextContentFromNode,
  makeInterator,
  PodNode,
  setContext,
  setFn,
  subUse,
  toAny,
} from '@podlite/schema'
import { BUILT_PATH } from '../src/constants'
import * as fs from 'fs'

const plugin = ({ built_path = BUILT_PATH }): PodliteWebPlugin => {
  const outCtx: PodliteWebPluginContext = {}
  const onExit = ctx => {
    if (!ctx.testing) {
      // save control.json
      fs.writeFileSync(`${built_path}/indexTerms.json`, JSON.stringify(outCtx.indexTerms, null, 2))
    }
    return { ...ctx, ...outCtx }
  }
  const isNodeContainsX = (node: PodNode) => {
    let isExistsDocBlocks = false

    const rules = {
      'X<>': (node, ctx, interator) => {
        // skip root block
        isExistsDocBlocks = true
      },
    }
    makeInterator(rules)(node, {})
    return isExistsDocBlocks
  }
  function findNearest(arr: PodNode[], index: number, checkFn: (node: PodNode) => boolean): PodNode | null {
    const leftPart = arr.slice(0, index).reverse()
    const rightPart = arr.slice(index + 1)
    const findIndex = (part: PodNode[]) => {
      const foundIndex = part.findIndex(item => checkFn(item))
      return foundIndex !== -1 ? foundIndex : null
    }

    const left = findIndex(leftPart)
    const right = findIndex(rightPart)

    const found = [left != null && leftPart[left], right != null && rightPart[right]].filter(Boolean)
    if (found.length && found.length < 2) {
      return found[0]
    }

    return left < right ? leftPart[left] : rightPart[right]
  }

  const processNode = (node: PodNode) => {
    const res: { xnode: FormattingCodeX; parent: PodNode }[] = []
    const rules = {
      ':block': (node, ctx, interator) => {
        // ctx.parent = node
        if (node.content) {
          // provess root block content
          return interator(node.content, { ...ctx, parent: node })
        }
      },
      ':para': (node, ctx, interator) => {
        if (['root', 'pod'].includes(ctx.parent.name)) {
          const isEmptyContent = node => getTextContentFromNode(node).match(/^\s*$/)
          if (isNodeContainsX(node)) {
            if (isEmptyContent(node)) {
              const indexOfCurrentNode = ctx.parent.content.findIndex(i => i === node)

              if (indexOfCurrentNode) {
                //find nearest addresable block
                const nearestBlock = findNearest(ctx.parent.content, indexOfCurrentNode, node => {
                  // check if node is string
                  if (typeof node !== 'string' && 'type' in node) {
                    return node.type === 'block'
                  }
                  return false
                })

                // set parent nearest addresable block
                if (node.content) {
                  // provess root block content
                  return interator(node.content, { ...ctx, parent: nearestBlock })
                }
              }
            }
          }
        }
        if (node.content) {
          // provess root block content
          return interator(node.content, { ...ctx, parent: ctx.parent })
        }
      },
      'X<>': (node, ctx) => {
        res.push({ xnode: node, parent: ctx.parent })
      },
    }
    makeInterator(rules)(node, {})
    return res
  }
  const onProcess = (recs: publishRecord[]) => {
    const res = recs.map(item => {
      const terms = processNode(item.node)
      const termWithUrl = terms.map(({ xnode, parent }) => {
        const urlParts = [item.publishUrl]
        if (parent && typeof parent !== 'string' && 'id' in parent) {
          urlParts.push(parent.id)
        }
        return {
          xnode,
          url: urlParts.join('#'),
          title: item.title,
          subtitle: item.subtitle,
        }
      })

      outCtx.indexTerms = [...(outCtx.indexTerms || []), ...termWithUrl].filter(x => Boolean(x.xnode.entry))
      return { ...item }
    })

    return res
  }

  return [onProcess, onExit]
}
export default plugin
