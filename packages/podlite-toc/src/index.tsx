import React from 'react'
import {Plugin, Location, mkBlock, PodliteDocument, getFromTree, getTextContentFromNode, mkItemBlock} from '@podlite/schema'
import { getTocPod, prepareDataForToc } from './helpers';
import makeAttrs from 'pod6/built/helpers/config'
let i = 0;
const getNodeId = (node, ctx )=>{
    const conf = makeAttrs(node, ctx)
    if ( conf.exists('id') ) {
        return  conf.getFirstValue('id')
    }
    return node.id
}
const setNodeId = (node, id )=>{
     node.id = id
     return node
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
            nodes.forEach(node => {
                const id = getNodeId(node, ctx)
                if (!id) {
                    setNodeId(node, ++i)
                }
            })
            const tocTree = prepareDataForToc(nodes)
            const podToc = getTocPod(tocTree)
            return processor(podToc)
        }
        },
        toHtml: (writer) =>{
            /** 
            =Toc head, Diagram, Image , table
            =for Toc title('Table of content')
            head1,head2
            =for Toc title('List of images')
            Image
            // head  => {name=>'head', level=>'*'}
            head1 => {name=>'head', level=>1} + SEMANTIC
            =item => {name=>'item', level=>'1'}

            */
            let fulltree
            writer.on('start', (tree:PodliteDocument) => {
                // TODO: tree should pass as third argument in pod6 release
                fulltree = tree
            })
            return  (node) => {
                // console.log(JSON.stringify(node,null,2))
                //  console.log(JSON.stringify(fulltree,null,2))
                const content = ( node.content[0] || {} ).value || ''
                const blocks = content.trim().split(/(?:\s*,\s*|\s+)/).filter(Boolean)
                if (blocks.length ) {
                    // check if tree does not have any element of TOC
                    const nodes = getFromTree(fulltree,...blocks);
                    writer.writeRaw('<div id="toc" class="toc">')
                    writer.writeRaw('<div id="toctitle">Table of Contents</div>')
                    if (!nodes.length) {
                        
                    }
                    // start TOC
                    const r = getFromTree(fulltree,...blocks)
                    let current_level = 1
                    for( const item of r ) {
                        const {name, level} = item
                        const text = getTextContentFromNode(node)
                        if (name === 'head') {
                            current_level = level
                            writer.writeRaw(`<div class="footnotes">`)
                        } else if (name === 'item') {
                            const level = current_level
                            // writer.writeRaw(`<ul class="sectlevel${level}">`)
                        }
                    }
                    // end TOC
                    writer.writeRaw('</div>')
                    // console.log(JSON.stringify(r[0], null, 2))
                }
                return node
            }
        }
    })
export default plugin


