import { PodliteWebPlugin, PodliteWebPluginContext, publishRecord } from './'
import {
  content,
  emptyContent,
  FormattingCodeX,
  getTextContentFromNode,
  indexAnchors,
  makeInterator,
  maskText,
  PodNode,
  setContext,
  setFn,
  subUse,
  toAny,
  toFragment,
} from '@podlite/schema'
import { BUILT_PATH } from './constants'
import * as fs from 'fs'

// the index entry as the site gets it: hidden words under the mask, the tree untouched
const maskedCopy = (value: unknown, covered = false): unknown => {
  if (Array.isArray(value)) return value.map(item => maskedCopy(item, covered))
  if (typeof value === 'string') return covered ? maskText(value) : value
  if (!value || typeof value !== 'object') return value
  const node = value as { type?: string; name?: string; value?: unknown; content?: unknown; guarded?: boolean }
  const hidden = covered || node.guarded === true || (node.type === 'fcode' && node.name === 'G')
  if ((node.type === 'text' || node.type === 'verbatim') && typeof node.value === 'string')
    return { ...node, value: hidden ? maskText(node.value) : node.value }
  return 'content' in node ? { ...node, content: maskedCopy(node.content, hidden) } : { ...node }
}

const publishedEntry = (xnode: FormattingCodeX): FormattingCodeX => {
  const copy = maskedCopy(xnode) as FormattingCodeX
  const hidden = (xnode as { guarded?: boolean }).guarded === true
  return hidden && copy.entry ? { ...copy, entry: copy.entry.map(maskText) } : copy
}

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
      let anchors: ReturnType<typeof indexAnchors> | undefined
      const termWithUrl = terms.map(({ xnode, parent }) => {
        const urlParts = [item.publishUrl]
        if (parent && typeof parent !== 'string' && parent.type === 'block' && parent.name === 'head') {
          // the anchor the page gives the heading, not one made of its text
          anchors = anchors ?? indexAnchors(item.node)
          const anchor = anchors.byNode.get(parent)
          if (anchor) urlParts.push(anchor)
        } else if (parent && typeof parent !== 'string' && 'id' in parent) {
          // the tree keeps the heading name; an anchor needs it shaped for a url
          urlParts.push(toFragment(String(parent.id)))
        }
        return {
          xnode: publishedEntry(xnode),
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
