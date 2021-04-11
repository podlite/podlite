
import  unified  from 'unified'
import markdown  from 'remark-parse'
import { Interface } from 'readline'
import { parseConfigFileTextToJson } from 'typescript'
import * as fs from 'fs'

import toAny  from 'pod6/built/exportAny'
import toHtml from 'pod6/built/exportHtml'
// import toAny  from '/Users/zag/Dropbox/Work/proj/js-pod6/built/exportAny'
const mkBlankLine = () => { return {"type": "blankline"} }
const mkVerbatim = (text) => {
    return mkNode({ "type": "verbatim", "value": text})
}

const mkNode = (attr) => {
    result.toJSON = () => { return {...attr}}
    return result
    function result () {}
}
const mkError = (text) => {
    return mkNode({ type:"verbatim", value:text, error:true})
    // return mkNode({ type:"verbatim", value:text(), error:true, location:location() })
}
const mkDefault = (attrs, content ) => {
        return mkError(JSON.stringify(attrs))
}

const mkFomattingCodeL = (attrs, content ) => {
    let res = mkNode({...attrs, type:'fcode', name:"L", content})
    return res
}

const mkFomattingCode = (attrs, content ) => {
    return mkNode({ type:'fcode', ...attrs, content})
}
const mkBlock = ( attrs, content ) => {
    
    const type="block"
    const name = attrs.name
    const contents = content
    const attributres = {...attrs}
    var result = mkNode({type,...attributres })
   
    result.toJSON = ()=>{
        return { type, ...attributres,  content: contents.filter(i=>i).map(i=> {  return ('function' === typeof i ) ? i.toJSON() : i })}
    }
    return result
}

//markdown specific
const mkReference = ( attrs, content, writer ) => {
    
    const type="block"
    const name = attrs.name
    const contents = content
    const attributres = {...attrs}
    var result = mkNode({type,...attributres })
   
    result.toJSON = ()=>{
        const definition = writer.linkmap[attributres.identifier]
        const meta = definition.url
        return mkFomattingCodeL({ meta}, content).toJSON()
    }
    return result

}



const rules = {
    '*' : ( writer, processor )=>( node, ctx, interator )=>{
        const { children, position, ...attr} = node 
        console.error(attr)
        return null
    },
    ':root' : ( writer, processor )=>( node, ctx, interator )=>{
        const { children, position, ...attr} = node 
        return mkBlock({name:"pod", location:position}, interator(children, ctx))
    },
    ':html': ( writer, processor )=>( node, ctx, interator )=>{
        const { children, position, ...attr} = node 
        return mkBlock({type:'block', name:'Html', location:position},[mkVerbatim(node.value)]);
    },
    ':heading' :  ( writer, processor )=>( node, ctx, interator )=>{
        // console.log(node)
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
        return mkBlock({name: 'item', type:'block', level:ctx['listLevel'], location1:position}, interator(children, { ...ctx, listLevel : savedListLevel , ordered: node.ordered}))
    },
    ':paragraph' :  ( writer, processor )=>( node, ctx, interator )=>{
        // console.log(log(node))
        const { children, position, ...attr} = node
        return mkBlock({type:'para'}, interator(children, { ...ctx}))
    },
    ':linkReference' : ( writer, processor )=>( node, ctx, interator )=>{
        // console.log(log(node))
        const { children, position, ...attr} = node
        return mkReference({type:'linkReference', ...attr}, interator(children, { ...ctx}), writer)
    },
    ':definition' : ( writer, processor )=>( node, ctx, interator )=>{
        // console.log(log(node))
        const { children, position, ...attr} = node
        writer.linkmap = writer.linkmap || {}
        writer.linkmap[attr.label] = { ...node }
        return null
    },
    ':inlineCode' : ( writer, processor )=>( node, ctx, interator )=>{
        // console.log(log(node))
        const { children, position, ...attr} = node
        return mkFomattingCode({name:"C", location:position}, [node.value])
        // return mkBlock({type:'linkReference'}, interator(children, { ...ctx}))
    },
    ':strong' : ( writer, processor )=>( node, ctx, interator )=>{
        // console.log(log(node))
        const { children, position, ...attr} = node
        return mkFomattingCode({name:"B", location:position}, interator(children, { ...ctx}))
        // return mkBlock({type:'linkReference'}, interator(children, { ...ctx}))
    },
    ':code' : ( writer, processor )=>( node, ctx, interator )=>{
        // console.log(log(node))
        const { children, position, ...attr} = node
        return mkBlock({type:'block', name:'code', location:position},[mkVerbatim(node.value)]);
    },
}    
// console.log(toAny)
 const toF = toAny({processor:1})
 .use(  rules )

const file = fs.readFileSync('./t/NODE_API.md')
var tree = unified().use(markdown).parse(file)
// var tree = unified().use(markdown).parse(`
// \`\`ee\`\` dd
// \`\`\`js
// dddd
//    sds **sd**
// `)


const log = (t)=> JSON.stringify(t, null,2)
// console.log(toF.run(tree).interator)
const  t = JSON.parse(JSON.stringify(toF.run(tree).interator.toJSON()))
const t2 = toF.run(tree).interator.toJSON()
// console.log(t.content[2].content[0].content[0].content)
// console.log(log(t.interator.toJSON())) 
// fs.writeFileSync("out.json", log(t.interator.toJSON()))
const  r = toHtml().run(t).toString()
r
// fs.writeFileSync("out.html", r.toString())
// console.log(r.toString())
// const process = (node, content )=>{
//     // convert position 
//     const {position} =  node
//     switch (node.type) {
//         case 'root':
//             return mkBlock({name:"pod", location:position}, content)
//         case 'inlineCode':
//             return mkFomattingCode({name:"C", location:position}, [node.value])
//         case 'text':
//             return mkNode({text:node.value})
//         case 'paragraph':
//             return mkBlock({type:'para'},content)
//         case 'code':
//             return mkBlock({type:'block', name:'code', location:position},[mkVerbatim(node.value)]);
//         case 'html':
//             return mkBlock({type:'block', name:'Html', location:position},[mkVerbatim(node.value)]);
//         case 'heading':
//             // console.log({node,content})
//             return mkBlock({type:'block', level:node.depth,name:'head', location:position}, content);
//         case 'listItem1':
//             return { node, content}
//         case 'list':
//             console.log({node,content})
//             return mkBlankLine()
//         case 'linkReference':
//             return mkBlankLine()
//         default:
//             console.log(node)
//             return mkDefault(node, content)
//             break;
//     }
//     return node
// }

// const visit = ( node ) => {
//     if ( Array.isArray( node ) ) {
//          return node.map(i =>visit(i))
//     } else {
//       const content =  'children' in node  ? visit( node.children ) : []
//       const { children, ...props } =  node
//       return process( props, content)
//     }
//     // return node
//   }

// const  new_tree = visit(tree)
// console.log(log(new_tree.toJSON()))
//  console.log(log(tree))


