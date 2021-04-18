import  unified  from 'unified'
import markdown  from 'remark-parse'
import toAny  from 'pod6/built/exportAny'

export const mdToPod6 = (src, extraRules? ) => {
    const md_tree = unified().use(markdown).parse(src)
    let definitionMap = {}
    toAny({processor:1})
    .use({'*:*':( writer, processor )=>( node, ctx, interator )=>{
        if (node.children) interator(node.children, { ...ctx})
    }})
    .use({':definition' : ( writer, processor )=>( node, ctx, interator )=>{
        definitionMap[node.identifier] = node
    }}).run(md_tree)
    const  res = toAny({processor:1})
    .use({'*:*':( writer, processor )=>( node, ctx, interator )=>{
        console.warn(node)
        if (node.children) interator(node.children, { ...ctx})
    }})

    .use({
        ':root': ( writer, processor )=>( node, ctx, interator )=>{
            // handle text with content
            const { children, position, ...attr} = node
            writer.write( "=begin pod\n")
            interator( children, ctx )
            writer.write( "=end pod\n")

        },
        ':heading' :  ( writer, processor )=>( node, ctx, interator )=>{
            const { children, position, ...attr} = node
            writer.write( `=head${node.depth} `)
            if (children) interator( children, ctx )
            writer.write( "\n")

        },
        ':text' :  ( writer, processor )=>( node, ctx, interator )=>{
            const { children, position, ...attr} = node
            writer.writeRaw(node.value)
            if (children) interator( children, ctx )
        },
        ':list' :  ( writer, processor )=>( node, ctx, interator )=>{
            // console.error(node)
            const savedListLevel = ctx['listLevel'] || 0
            const newctx = { ...ctx, listLevel:savedListLevel+1, ordered: node.ordered ? 'ordered' : 'itemized'}
            const { children, position, ...attr} = node
            if (children) interator( children, newctx )
        },
        ':listItem' :  ( writer, processor )=>( node, ctx, interator )=>{
            const { children, position, ...attr} = node
            // console.error(node)
            writer.write(`=begin item${ctx['listLevel']} ${ctx.ordered ? ":numbered" : ''} \n`)
            if (children) { interator( children, ctx ) }
            writer.write(`=end item${ctx['listLevel']}\n`)
        },
        ':paragraph' :  ( writer, processor )=>( node, ctx, interator )=>{
            const { children, position, ...attr} = node
            writer.write(`=begin para\n`)
            if (children) { interator( children, ctx ) }
            writer.write(`\n=end para\n`)
        },
        ':linkReference' : ( writer, processor )=>( node, ctx, interator )=>{
            // console.log(log(node))
            const { children, position, ...attr} = node
            const definition = definitionMap[attr.identifier]
            const meta = definition?.url || ''
            writer.write(`L<`)
            if (children) { interator( children, ctx ) }
            writer.write(`|${meta}>`)
        },
        ':definition' : ( writer, processor )=>( node, ctx, interator )=>{
            return null
        },
        ':inlineCode' : ( writer, processor )=>( node, ctx, interator )=>{
            const { children, position, ...attr} = node
            writer.write(`C<${node.value}>`)
        },
        ':strong' : ( writer, processor )=>( node, ctx, interator )=>{
            const { children, position, ...attr} = node
            writer.write(`B<`)
            if (children) { interator( children, ctx ) }
            writer.write(`>`)
        },
        ':link': ( writer, processor )=>( node, ctx, interator )=>{ 
            const { children, position, ...attr} = node
            writer.write(`L<`)
            if (children) { interator( children, ctx ) }
            writer.write(`|${node.url}>`)
        },
        ':image': ( writer, processor )=>( node, ctx, interator )=>{
            const { children, position, ...attr} = node 
            writer.write(`=begin Image :title('${node.title}') :alt('${node.alt}')\n`)
            writer.write(node.url)
            writer.write(`\n=end Image\n`)
        },
        ':html': ( writer, processor )=>( node, ctx, interator )=>{
            const { children, position, ...attr} = node 
            writer.write(`=begin Html\n`)
            writer.write(`${node.value}`)
            writer.write(`\n=end Html\n`)
        },
        ':code' : ( writer, processor )=>( node, ctx, interator )=>{
            // console.log(JSON.stringify(node,null,2))
            const { children, position, lang, ...attr} = node
            writer.write(`=begin code ${lang ? ':lang(\''+lang+'\')' : ""}\n`)
            writer.write(`${node.value}`)
            writer.write(`\n=end code\n`)
        },
        ...extraRules
    },
    ).run(md_tree) 
    return res.toString()
}
