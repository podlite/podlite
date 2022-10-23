import  {unified}  from 'unified'
import markdown  from 'remark-parse'
import remarkGfm from 'remark-gfm'
import toAny  from 'pod6/built/exportAny'
import { AstTree, BlockImage, Location, mkBlock, mkFomattingCode, mkFomattingCodeL, mkVerbatim } from '@podlite/schema'
import { mkRootBlock } from '@podlite/schema'
import { mkImage } from '@podlite/schema'
import { mkNode } from '@podlite/schema'
import { mkCaption } from '@podlite/schema'
import { mkFomattingCodeDelete } from '@podlite/schema'

export const  md2ast = ( src, extraRules? ) :AstTree => {
    // first convert mardown to ast 
    const md_tree = unified().use(markdown).use(remarkGfm).parse(src)
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
            return mkRootBlock({}, interator(children, ctx))
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
            return mkBlock({type:'para', location:position, text: 'text', margin:"",}, interator(children, { ...ctx}))
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
            return mkFomattingCode({name:"C"}, [node.value])
        },
        ':strong' : ( writer, processor )=>( node, ctx, interator )=>{
            const { children, position, ...attr} = node
            return mkFomattingCode({name:"B"}, interator(children, { ...ctx}))
        },
        ':emphasis' : ( writer, processor )=>( node, ctx, interator )=>{
            const { children, position, ...attr} = node
            return mkFomattingCode({name:"I"}, interator(children, { ...ctx}))
        },
        ':link': ( writer, processor )=>( node, ctx, interator )=>{ 
            const { children, position, ...attr} = node
            return mkFomattingCodeL({ meta:node.url}, interator(children, { ...ctx}))
        },
        ':html': ( writer, processor )=>( node, ctx, interator )=>{
            const { children, position, ...attr} = node 
            return mkBlock({type:'block', name:'Html', location:position},[mkVerbatim(node.value)]);
        },
        ':code' : ( writer, processor )=>( node, ctx, interator )=>{
            const { children, position, lang, meta, ...attr} = node
            let config = []
            if (lang) { config.push({ name: 'lang', value:lang, type:"string"})}
            if (meta) { config.push({ name: 'meta', value:meta, type:"string"})} //  filled as is from markdown
            return mkBlock({type:'block', name:'code', config, location:position},[mkVerbatim(node.value)]);
        },
        ':image':  ( writer, processor )=>( node, ctx, interator ):BlockImage=>{
            const { title, alt, url, position, ...attr} = node
            let config = []
            return mkBlock({type:'block', name:'Image', config, location:position},[mkImage(url,alt),mkCaption([title])]);
        },
        ':thematicBreak': ( writer, processor )=>( node, ctx, interator )=>{
            return null // TODO: add support for "thematic break"
        },
        ':blockquote' :  ( writer, processor )=>( node, ctx, interator )=>{
            const { children, position, ...attr} = node
            return mkBlock({name:'nested', location:position}, interator(children, { ...ctx}))
        },
        //table section
        ':table' :  ( writer, processor )=>( node, ctx, interator )=>{
            const { children, position, ...attr} = node
            return mkBlock({name:'table', location:position}, interator(children, { ...ctx}))
        },
        ':tableRow' :  ( writer, processor )=>( node, ctx, interator )=>{
            const { children, position, ...attr} = node
            return mkBlock({name:'table_row', location:position}, interator(children, { ...ctx}))
        },
        ':tableCell' :  ( writer, processor )=>( node, ctx, interator )=>{
            const { children, position, ...attr} = node
            return mkBlock({name:'table_cell', location:position}, interator(children, { ...ctx}))
        },
        ':delete': ( writer, processor )=>( node, ctx, interator )=>{
            const { children, position, ...attr} = node
            return mkFomattingCodeDelete( interator(children, { ...ctx}))
        },
        ':break': ( writer, processor )=>( node, ctx, interator )=>{
            return null
        },
        ...extraRules
    }).run(md_tree)
    return res.interator
}