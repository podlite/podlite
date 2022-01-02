import { AstTree, BlockImage, BlockItem, Location,  RootBlock } from "./types"

export const mkNode = (attr) => {
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
     const attributres = {...attrs}
     var result = mkNode({type,...attributres, content:filterNulls(content) })
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

export interface mkBlockImageParams {
    src: string,
    alt? : string,
    location:Location,
    margin:string
}

export const mkBlockImage = ({ src, alt, location, margin }: mkBlockImageParams): BlockImage => {
    return mkBlock({ name: 'image', location, margin }, [{ type: 'image', src, alt }])
}

export const mkRootBlock =  ({ margin }, content): RootBlock => {
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
