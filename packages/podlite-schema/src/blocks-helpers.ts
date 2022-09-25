import { AstTree, BlockCaption, BlockItem, Location,  PodNode,  RootBlock, Toc, TocItem, TocList, Node, Image } from "./types"
import { nanoid } from 'nanoid'

export const mkNode = <P extends  Record<string, any>>(attr:P):P => {
    return {...attr}
 }
 
export const filterNulls = ( content )=>{ 
     if( Array.isArray(content) ) {
         return content.filter(i=>i)
     }
     console.warn('[podlite-schema] filterNulls got not array as content')
}
export const mkBlock = ( attrs, content ) => {
     const type="block"
     const name = attrs.name
     const attributes = {id: nanoid(), margin: "", ...attrs}
     var result = mkNode({type, ...attributes, content:filterNulls(content) })
     return result
 }

 export const mkBlankline = ()=>{ return mkNode({type:'blankline'}) }

export  const mkFomattingCode = (attrs, content ) => {
    return mkNode({ type:'fcode', ...attrs, content})
}

export  const mkFomattingCodeL = (attrs, content ) => {
     let res = mkNode({...attrs, type:'fcode', name:"L", content:filterNulls(content)})
     return res
 }
 
export const mkVerbatim = (text) => {
    return mkNode({ "type": "verbatim", "value": text})
}
// Table of contents helpers
export const mkToc = (content:TocList, title?:string):Toc => {
    return mkNode({type:'toc', title, content}) 
}
export const mkTocList = (content:Array<TocItem|TocList>, level:number):TocList => {
    return mkNode({type:'toc-list', level, content}) 
}
export const mkTocItem = (content:PodNode):TocItem => {
    return mkNode({type:'toc-item', node:content, content:[content]}) 
}
    
export const mkCaption = (content:Array<Node>):BlockCaption => {
    return {
    type: 'block',
    name:'caption',
    content
    }
}
export const mkImage = (src:string, alt?:string):Image => {
    return {
    type: 'image',
    src,
    alt
    }
}

export const mkRootBlock =  ({ margin = "" }, content): RootBlock => {
    return mkBlock({ name: 'root',  margin },content)
}
export interface mkBlockItemParams {
    level: number,
    location:Location,
    margin:string
}

export const mkItemBlock = ({ level, location, margin }: mkBlockItemParams, content:AstTree):BlockItem => {
    return mkBlock({ name: 'item',  level, margin, location }, content)
}
