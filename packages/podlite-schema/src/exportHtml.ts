import toAny from './exportAny'
import { subUse, wrapContent, emptyContent, content, setFn, handleNested } from './helpers/handlers'
import { isNamedBlock } from './helpers/makeTransformer'
import  makeAttrs  from './helpers/config'
import htmlWriter from './writerHtml'
import clean_plugin from './plugin-clean-location'
import { getNodeId } from './ast-helpers'
const rules = {
    ':text': ( writer, processor )=>( node, ctx, interator )=>{
        // handle text with content
        if (node.value) {
            writer.write( node.value )
        } else { interator( node.content, ctx ) }
    },
        
    // Formatting codes
    'A<>': ( writer, processor ) => ( node, ctx, interator ) => {
        //get replacement text
        if (! (ctx.alias && ctx.alias.hasOwnProperty(node.content)) ) {
            writer.write(`A<${node.content}>`)
        } else {
            const src = ctx.alias[ node.content ].join('\n')
            const tree_1 = processor( src )
            // now clean locations
            const tree = clean_plugin()(tree_1)
            if ( tree[0].type === 'para') {
                interator( tree[0].content, ctx )
            } else {
                interator( tree, ctx )
            }
        }
    },
    'C<>': wrapContent('<code>','</code>'),
    'D<>':  ( writer, processor ) => ( node, ctx, interator ) => {
        
        // @ts-ignore
        let synonyms:Array<any> = { node }
        let definition:string[] = [node.content[0]]
        if ( synonyms ) {
            definition = synonyms
        }

        if ( !writer.hasOwnProperty('DEFINITIONS') ) { writer.DEFINITIONS = []}
        writer.DEFINITIONS.push({ definition })

        writer.writeRaw('<dfn>')
        interator(node.content, ctx)
        writer.writeRaw('</dfn>')

     },
    'B<>': wrapContent('<strong>','</strong>'),
    'I<>': wrapContent('<em>','</em>'),
    'R<>': wrapContent('<var>','</var>'),
    'K<>': wrapContent('<kbd>','</kbd>'),
    "L<>": setFn(( node, ctx ) => {
        let { meta } = node
        if ( meta === null) {
            meta = node.content
        }
        return  wrapContent( `<a href="${meta}">`, `</a>` )
    }),

    /**
     * CSS rules for footnotes
     
    .footnote a {
        text-decoration: none;
    }
    .footnotes {
    border-top-style: solid;
    border-top-width: 1px;
    border-top-color: #eee;
    }
     */
    'N<>' : ( writer, processor ) => {
        writer.addListener('end', ()=>{
            if ( !writer.hasOwnProperty('FOOTNOTES') ) { return }
            const footnotes = writer.FOOTNOTES
            if ( footnotes.length < 1 ) { return } // if empty footnotes
            writer.writeRaw(`<div class="footnotes">`)
            footnotes.map((footnote) =>{
               writer.writeRaw(`<p><sup id="${footnote.fnId}" class="footnote"><a href="#${footnote.fnRefId}">[${footnote.gid}]</a></sup> `)
               footnote.make()
               writer.writeRaw(`</p>`)
            })
           writer.writeRaw(`</div>`)
           
        })
        return ( node, ctx, interator ) => {
            // skip empty notes
            if ( node.content.length < 1 ) { return }
            if ( !writer.hasOwnProperty('gid') ) { writer.gid = 1}
            // get foot note id
            const gid = writer.gid++
            const fnRefId = `fnref:${gid}`
            const fnId = `fn:${gid}`
            writer.writeRaw(`<sup id="${fnRefId}" class="footnote"><a href="#${fnId}">[${gid}]</a></sup>`)
            if ( !writer.hasOwnProperty('FOOTNOTES') ) { writer.FOOTNOTES = []}
            writer.FOOTNOTES.push({
                gid,
                fnRefId,
                fnId,
                make: ( )=>{ interator(node.content, ctx) }
            })
        }
    },
    'S<>':( writer, processor ) => ( node, ctx, interator ) => {
        const content = node.content || ''
        const spaces = content.replace(/ /g, '&nbsp;')
        const newFeed = spaces.replace(/\n/g, '</br>')
        writer.writeRaw(newFeed)
    },
    'T<>': wrapContent('<samp>','</samp>'),
    'U<>': wrapContent('<u>','</u>'),
    'V<>': content,
    'X<>' : ( writer, processor ) => ( node, ctx, interator ) => {
        interator(node.content, ctx)
        let { entry } =  node 
        if ( entry === null && node.content.length > 0) {
            //@ts-ignore
             entry = [node.content[0]]
        } else { return }
        if ( !writer.hasOwnProperty('INDEXTERMS') ) { writer.INDEXTERMS = []}
         writer.INDEXTERMS.push({
            entry
         })
     },
    'Z<>': emptyContent,

    'pod': content,
    ':code': wrapContent('<pre><code>', '</code></pre>'),
    'code': handleNested( wrapContent('<pre><code>', '</code></pre>') ),
    'data': emptyContent,
    ':verbatim': ( writer, processor ) => ( node, ctx, interator ) => { 
        if (node.error) {
            writer.emit("errors", node.location )
        }
        interator( node.value ) 
    },
    ':blankline': emptyContent,
    ':ambient': emptyContent,
    // Directives 
    ':config': setFn(( node, ctx ) => {
        // setup context
        if ( ! ctx.hasOwnProperty('config') ) ctx.config = {}
        //collect configs in context
        ctx.config[node.name] = node.config
        return emptyContent}),
    ':alias': setFn(( node, ctx ) => {
        // set alias
        if ( ! ctx.hasOwnProperty('alias') ) ctx.alias = {}
        //collect configs in context
        ctx.alias[node.name] = node.replacement
        return emptyContent}),
    
    // block =para
    'para': handleNested( content ),
    ':para':wrapContent('<p>', '</p>'),
    'head:block': subUse({
                       // inside head don't wrap into <p>
                            ':para' : content,
                        },
                        setFn(( node, ctx ) => {
                            const {level} = node
                            const id = getNodeId(node, ctx)
                            return wrapContent( `<h${level}${ id ? ` id="${id}"` : ''}>`, `</h${level}>` )
                        })
                    ),
    ':list': setFn(( node, ctx ) => 
                    node.list === 'ordered' ? wrapContent('<ol>', '</ol>') 
                                            : node.list ===  'variable' ? wrapContent('<dl>', '</dl>') 
                                                                        : wrapContent('<ul>', '</ul>')
                    ), 
    'item:block':  ( writer, processor ) => ( node, ctx, interator ) => {
        // make text from first para
        if (! (node.content instanceof Array)) {
            console.error('[pod6] item:block : Error in content of ' + JSON.stringify(node))
        }
        const [ firstPara, ...other ] = node.content
        writer.writeRaw('<li>')
        // TODO: get cases for handle first para in items
        // interator([...firstPara.content, ...other], ctx)
        interator(node.content, ctx)
        writer.writeRaw('</li>')
    },
    'comment:block': emptyContent,
    'defn':wrapContent('','</dd>'),
    'term:para': wrapContent('<dt>','</dt><dd>'),
    'nested': handleNested( content, 1 ),
    'output': handleNested( wrapContent('<pre><samp>', '</samp></pre>'), 1),
    'input':  handleNested( wrapContent('<pre><kbd>', '</kbd></pre>'), 1),
    // table section
    'table:block' : handleNested(
                                ( writer, processor ) => 
                                        ( node, ctx, interator ) => 
                                            {
                                                const conf = makeAttrs(node, ctx)
                                                writer.writeRaw('<table>')
                                                if ( conf.exists('caption') ) {
                                                    writer.writeRaw('<caption>')
                                                    writer.write(conf.getFirstValue('caption'))
                                                    writer.writeRaw('</caption>')
                                                }
                                                interator(node.content, ctx)
                                                writer.writeRaw('</table>')
                                            }
                    ),
    ':separator' :  emptyContent,
     'table_row' :  wrapContent('<tr>','</tr>'),
     'table_cell':  wrapContent('<td>','</td>'),
     'table_head' : subUse(
                              { 
                                'table_cell': wrapContent('<th>','</th>')
                              },
                              wrapContent('<tr>','</tr>')
                            ),
    // Toc
    ':toc' : ( writer, processor ) => ( node, ctx, interator ) => {
        writer.writeRaw('<div className="toc">')
        // get toc title
        const conf = makeAttrs(node, ctx)
        if ( conf.exists('title') ) {
            const title = conf.getFirstValue('title');
            writer.writeRaw('<div className="toctitle">')
            writer.write(title)
            writer.writeRaw('</div>')
        }
        interator(node.content, ctx)
        writer.writeRaw('</div>')
    },
    ':toc-list' : setFn(( node, ctx ) => wrapContent(`<ul class="toc-list listlevel${node.level}">`,'</ul>')),
    ':toc-item' : setFn(( node, ctx ) => wrapContent('<li class="toc-item">','</li>')),
    ':image': ( writer, processor ) => ( node, ctx, interator ) => {
        writer.writeRaw(`<img src="${node.src}" alt="${node.alt}"/>`)
    }
}

    const toHtml = ( opt ) => toAny( { writer:htmlWriter, ...opt } ).use(
    '*', ( writer, processor ) => {  return  ( node, ctx, interator ) => {

            // skip warnings for semantic blocks
            const isSemanticBlock = ( node ) => { 
                const name = node.name || ''
                const isTypeBlock = ( node.type || '') === 'block'
                return isTypeBlock && name === name.toUpperCase()
            }

            //Named blocks for which no explicit class has been defined or loaded are
            //usually not rendered by the standard renderers.
             if (isNamedBlock(node.name)) {
                 return true
             }

            if ( isSemanticBlock(node) ) { 
                const name  = node.name
                writer.writeRaw('<h1 class="')
                writer.write( name )
                writer.writeRaw('">')
                writer.write (name )
                writer.writeRaw('</h1>')
            } else {
                console.warn("[pod6] Unhandled node" + JSON.stringify( node, null, 2))
            }
            if ( node.hasOwnProperty('content')) {
                interator(node.content, ctx)
            }
        }
    }
    ).use(rules)

export default toHtml
