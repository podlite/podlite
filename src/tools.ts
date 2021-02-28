import  unified  from 'unified'
import markdown  from 'remark-parse'
import toAny  from 'pod6/built/exportAny'

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


export const  md2ast = ( src, extraRules? )=> {
    // first convert mardown to ast 
    const md_tree = unified().use(markdown).parse(src)
    // first pass : collect linkRefs
    let definitionMap = {}
    toAny({processor:1})
    .use({'*:*':( writer, processor )=>( node, ctx, interator )=>{
        if (node.children) interator(node.children, { ...ctx})
    }})
    .use({':definition' : ( writer, processor )=>( node, ctx, interator )=>{
        definitionMap[node.identifier] = node
    }}).run(md_tree)

    // second stage - make Universal AST nodes
    const uast = []
    const  res = toAny({processor:1})
    .use({'*:*':( writer, processor )=>( node, ctx, interator )=>{
        console.warn('[Podlite]')
        console.warn(JSON.stringify(node,null,2))
        if (node.children) interator(node.children, { ...ctx})
    }})
    .use({
        ':root' : ( writer, processor )=>( node, ctx, interator )=>{
            const { children, position, ...attr} = node 
            return mkBlock({name:"pod", location:position}, interator(children, ctx))
        },
        ':heading' :  ( writer, processor )=>( node, ctx, interator )=>{
            const { children, position, ...attr} = node
            return mkBlock({type:'block', level:node.depth,name:'head', location:position},  interator(children, ctx));
        },
        ':text' :  ( writer, processor )=>( node, ctx, interator )=>{
            const { children, position, ...attr} = node
            return node.value
            // return mkNode({type:"text", value: node.value})
        },
        ':list' :  ( writer, processor )=>( node, ctx, interator )=>{
            const savedListLevel = ctx['listLevel'] || 0
            const { children, position, ...attr} = node
            return mkBlock( { type:'list', level:savedListLevel+1, list: node.ordered ? 'ordered' : 'itemized' }, interator(children, { ...ctx, listLevel : savedListLevel + 1, ordered: node.ordered}))
        },
        ':listItem' :  ( writer, processor )=>( node, ctx, interator )=>{
            const savedListLevel = ctx['listLevel'] || 0
            const { children, position, ...attr} = node
            return mkBlock({name: 'item', type:'block', level:ctx['listLevel'], location:position}, interator(children, { ...ctx, listLevel : savedListLevel , ordered: node.ordered}))
        },
        ':paragraph' :  ( writer, processor )=>( node, ctx, interator )=>{
            const { children, position, ...attr} = node
            return mkBlock({type:'para', location:position}, interator(children, { ...ctx}))
        },
        ':linkReference' : ( writer, processor )=>( node, ctx, interator )=>{
            const { children, position, ...attr} = node
            const definition = definitionMap[attr.identifier]
            const meta = definition?.url || ''
            return mkFomattingCodeL({ meta}, interator(children, { ...ctx}))
        },
        ':definition' : ( writer, processor )=>( node, ctx, interator )=>{
            return null
        },
        ':inlineCode' : ( writer, processor )=>( node, ctx, interator )=>{
            const { children, position, ...attr} = node
            return mkFomattingCode({name:"C", location:position}, [node.value])
        },
        ':strong' : ( writer, processor )=>( node, ctx, interator )=>{
            const { children, position, ...attr} = node
            return mkFomattingCode({name:"B", location:position}, interator(children, { ...ctx}))
        },
        ':emphasis' : ( writer, processor )=>( node, ctx, interator )=>{
            const { children, position, ...attr} = node
            return mkFomattingCode({name:"I", location:position}, interator(children, { ...ctx}))
        },
        ':link': ( writer, processor )=>( node, ctx, interator )=>{ 
            const { children, position, ...attr} = node
            return mkFomattingCodeL({ meta:node.url,location:position}, interator(children, { ...ctx}))
        },
        ':html': ( writer, processor )=>( node, ctx, interator )=>{
            const { children, position, ...attr} = node 
            return mkBlock({type:'block', name:'Html', location:position},[mkVerbatim(node.value)]);
        },
        ':code' : ( writer, processor )=>( node, ctx, interator )=>{
            const { children, position, lang, ...attr} = node
            let config = {}
            if (lang) { config = { name: 'lang', value:"lang"}}
            return mkBlock({type:'block', name:'code', config, location:position},[mkVerbatim(node.value)]);
        },
        ':image':  ( writer, processor )=>( node, ctx, interator )=>{
            const { title, alt, url, position, ...attr} = node
            let config = []
            if (!!title) { config.push({ name: 'title', value:title}) }
            if (!!alt) { config.push({ name: 'alt', value:alt}) }
            return mkBlock({type:'block', name:'Image', config, location:position},[mkVerbatim(url)]);
        },
        ':thematicBreak': ( writer, processor )=>( node, ctx, interator )=>{
            return null
        },
        ':blockquote' :  ( writer, processor )=>( node, ctx, interator )=>{
            const { children, position, ...attr} = node
            return mkBlock({type:'nested'}, interator(children, { ...ctx}))
        },
        //table section
        ':table' :  ( writer, processor )=>( node, ctx, interator )=>{
            const { children, position, ...attr} = node
            return mkBlock({type:'table', location:position}, interator(children, { ...ctx}))
        },
        ':tableRow' :  ( writer, processor )=>( node, ctx, interator )=>{
            const { children, position, ...attr} = node
            return mkBlock({type:'table_row', location:position}, interator(children, { ...ctx}))
        },
        ':tableCell' :  ( writer, processor )=>( node, ctx, interator )=>{
            const { children, position, ...attr} = node
            return mkBlock({type:'table_cell', location:position}, interator(children, { ...ctx}))
        },
        ':delete': ( writer, processor )=>( node, ctx, interator )=>{
            return null
        },
        ':break': ( writer, processor )=>( node, ctx, interator )=>{
            return null
        },
        ...extraRules
    }).run(md_tree)
    return res.interator
}