import React from 'react'
import {Plugin, Location, mkBlock, PodliteDocument, getFromTree, getTextContentFromNode, mkItemBlock, mkTocItem, mkTocList, mkToc, TocList, Toc, getNodeId, BlockImage} from '@podlite/schema'
import { getTocPod, prepareDataForToc } from './helpers';
import makeAttrs from 'pod6/built/helpers/config'
import { isNamedBlock } from 'pod6/built/helpers/makeTransformer';
import { PodNode } from '@podlite/schema';
export const getContentForToc = (node: PodNode): string => {
    if (typeof node !== "string" && "type" in node) {
        if ( node.type === 'block') {
            if (isNamedBlock(node.name)) {
                const conf = makeAttrs(node, {})
                const caption = ((conf, nodeName)=>{
                    if ( conf.exists('caption') ) {
                        return conf.getFirstValue('caption')
                    } else
                    if ( conf.exists('title') ) {
                        return conf.getFirstValue('title')
                    } 
                    return `${nodeName} not have :caption`
                })(conf, node.name)
                return caption
            }
            if (node.name == 'image') {
                if ('caption' in node ) {
                    // @ts-ignore
                    return node.caption || 'image not have caption'
                }
                
            }
            return getTextContentFromNode(node);
        }
        if (node.type === 'image') {
            return node.caption || 'image not have caption'
        }
      }
    return 'Not supported toc element';
  }
export const plugin:Plugin =({
        toAst: (writer) => (node) => {
            if (typeof node !== "string" && 'type' in node && 'content' in node && node.type === 'block') {
                const content = node.content[0] || {}
                if (typeof content !== "string" && 'location' in node && 'value' in content) {
                    // get link and alt text
                    const data = content.value
                    return node
                }
            }
        },
        //@ts-ignore
        toAstAfter:(writer, processor, fulltree) => {
            // let fulltree
            // writer.on('start', (tree:PodliteDocument) => {
            //     // TODO: tree should pass as third argument in pod6 release
            //     fulltree = tree
            // })
            return (node,ctx) => {
            const content = getTextContentFromNode(node)
            const blocks = content.trim().split(/(?:\s*,\s*|\s+)/)
                                    .filter(Boolean)
                                    .map(blockName=>{
                                        if (blockName.toLowerCase() == 'image') {
                                            return 'image'
                                        }
                                        return blockName
                                    })
            const nodes = getFromTree(fulltree, ...blocks)
            const tocTree = prepareDataForToc(nodes)
            const createList = (items:any[], level):TocList=>{
                const resultList = []
                items.map(item => {
                    const {level, node, content} = item
                    // create new node for each item
                    const text = getContentForToc(node)
                    //TODO: getNodeId should use ctx of node, but using {} instead
                    const para = `L<${text}|#${getNodeId(node,{})}>`  
                    const tocNode = processor(para)[0];
                    resultList.push(mkTocItem(tocNode))
                    if ( Array.isArray(content) && content.length > 0) {
                        resultList.push(createList( content,level + 1) )
                    };
                })
                return mkTocList(resultList, level)
            }
            const conf = makeAttrs(node, ctx)
            const tocTitle = conf.getFirstValue('title')
            const makeToc = (tocTree: any, title):Toc => {
            
               return  mkToc(createList(tocTree.content, 1), title)
            }

            return makeToc(tocTree, tocTitle)
        }
        },
        
    })
export default plugin


