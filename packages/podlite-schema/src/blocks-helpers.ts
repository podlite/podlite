import { BlockImage, Location,  RootBlock } from "./types"

export const mkNode = (attr) => {
    return {...attr}
 }
 
export const filterNulls = ( content )=>{ 
     if( Array.isArray(content) ) {
         return content.filter(i=>i)
     }
 }
export const mkBlock = ( attrs, content ) => {
     const type="block"
     const name = attrs.name
     const attributres = {...attrs}
     var result = mkNode({type,...attributres, content:filterNulls(content) })
     return result
 }
 
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
