import React from 'react'
import {Plugin, Location, mkBlock, PodliteDocument, getFromTree, getTextContentFromNode, mkItemBlock, mkTocItem, mkTocList, mkToc, TocList, Toc, getNodeId} from '@podlite/schema'
import { getTocPod, prepareDataForToc } from './helpers';
import makeAttrs from 'pod6/built/helpers/config'

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
        toAstAfter:(writer, processor) => {
            let fulltree
            writer.on('start', (tree:PodliteDocument) => {
                // TODO: tree should pass as third argument in pod6 release
                fulltree = tree
            })
            return (node,ctx) => {
            const content = getTextContentFromNode(node)
            const blocks = content.trim().split(/(?:\s*,\s*|\s+)/).filter(Boolean)
            const nodes = getFromTree(fulltree, ...blocks)
            const tocTree = prepareDataForToc(nodes)
            const createList = (items:any[], level):TocList=>{
                const resultList = []
                items.map(item => {
                    const {level, node, content} = item
                    // create new node for each item
                    const text = getTextContentFromNode(node)
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


