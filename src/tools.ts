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
    // console.log(md_tree)
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
        console.warn(node)
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
            // console.error(node)
            const savedListLevel = ctx['listLevel'] || 0
            const { children, position, ...attr} = node
            return mkBlock( { type:'list', level:savedListLevel+1, list: node.ordered ? 'ordered' : 'itemized' }, interator(children, { ...ctx, listLevel : savedListLevel + 1, ordered: node.ordered}))
        },
        ':listItem' :  ( writer, processor )=>( node, ctx, interator )=>{
            // console.error(node)
            const savedListLevel = ctx['listLevel'] || 0
            const { children, position, ...attr} = node
            return mkBlock({name: 'item', type:'block', level:ctx['listLevel'], location:position}, interator(children, { ...ctx, listLevel : savedListLevel , ordered: node.ordered}))
        },
        ':paragraph' :  ( writer, processor )=>( node, ctx, interator )=>{
            // console.log(log(node))
            const { children, position, ...attr} = node
            return mkBlock({type:'para'}, interator(children, { ...ctx}))
        },
        ':linkReference' : ( writer, processor )=>( node, ctx, interator )=>{
            // console.log(log(node))
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
        ':link': ( writer, processor )=>( node, ctx, interator )=>{ 
            return mkFomattingCodeL({ meta:node.url}, interator(node.children, { ...ctx}))
        },
        ':html': ( writer, processor )=>( node, ctx, interator )=>{
            const { children, position, ...attr} = node 
            return mkBlock({type:'block', name:'Html', location:position},[mkVerbatim(node.value)]);
        },
        ':code' : ( writer, processor )=>( node, ctx, interator )=>{
            // console.log(JSON.stringify(node,null,2))
            const { children, position, lang, ...attr} = node
            let config = {}
            if (lang) { config = { name: 'lang', value:"lang"}}
            return mkBlock({type:'block', name:'code', config, location:position},[mkVerbatim(node.value)]);
        },
        ...extraRules
    }).run(md_tree)
    return res.interator
}