import React from 'react'
import {createElement} from 'react'
import toAny  from 'pod6/built/exportAny'
import { subUse, wrapContent, emptyContent, content as nodeContent, setFn, handleNested } from 'pod6/built/helpers/handlers'
import clean_plugin from 'pod6/built/plugin-clean-location'
import makeAttrs from 'pod6/built/helpers/config'
import { isNamedBlock, isSemanticBlock } from 'pod6/built/helpers/makeTransformer'
import {parse} from 'pod6'
import Writer from 'pod6/built/writer'
import {isValidElementType} from  'react-is'
import {Verbatim, PodNode, Text, Rules} from '@podlite/schema'
import * as SCHEMA from '@podlite/schema'

export type CreateElement = typeof React.createElement
// const createElement = React.createElement
const helperMakeReact = ({wrapElement})=>{
    let i_key_i = 0;
    let mapByType= {};
    const getIdForNode = ({type="notype",name="noname"}) =>{
        const type_idx = `${type}_${name}`
        if ( ! mapByType[type_idx]  ) { mapByType[type_idx] = 0}
        ++mapByType[type_idx]
        return `${type_idx}_${mapByType[type_idx]}`
    }
    return function(src:string|Function, node:PodNode, children )  {
        // for string return it
        if (typeof node == 'string') {
            return node
        }
        const { ...attr} = node
        const key = 'type' in node  &&  node.type ? getIdForNode(node) : ++i_key_i
        const result = 
            typeof src === 'function'
                            ? src({ ...attr, key , children}, children)
                            : React.createElement(src,{ key }, children  )
        // console.log(result.props.children)
        // // create react element and pass key
        // if (!isValidElementType(src)) {
        //     throw new Error(`Bad React element for ${ruleName} rule `)
        // }

        if (typeof wrapElement === 'function') {
            return wrapElement( node, result)
        }
        return result
    }
} 

export interface  WrapElement {
    (
    node: PodNode,
    ...children: React.ReactChild[]
  ) : JSX.Element
    }
const Podlite: React.FC<{
    [key: string]: any
    children: string
    // options?: {file?:string, plugins?:any, wrapElement?:WrapElement}
    file?:string,
    plugins?:any,
    wrapElement?:WrapElement
  }>  = ({ children, ...options }) => {
          // console.log({podlite:podlite(children, options)})
    // return React.cloneElement(
            const result:any = podlite(children, options)
            return result
        //      props as React.Props<any>
            // )
    // return React.cloneElement(
    //     podlite(children, options),
    // //   props as React.Props<any>
    // )
  }
const mapToReact = (makeComponent):Rules => {
    const mkComponent = (src) => ( writer, processor )=>( node, ctx, interator )=>{
            return makeComponent(src, node, interator(node.content, { ...ctx}) )
        }
    return {
    'pod': mkComponent('div'),
    'data': emptyContent(),
    ':ambient': emptyContent(),
    ':code': mkComponent(({ children, key })=><code key={key}><pre>{children}</pre></code>),
    'code': mkComponent(({ children, key })=><code key={key}><pre>{children}</pre></code>),

    ':text':( writer, processor )=>( node:Text, ctx, interator )=>{
        return node.value
    },
    ':verbatim' : ( writer, processor )=>( node:Verbatim, ctx, interator )=>{
        return node.value
    },
    'head:block': subUse({
        // inside head don't wrap into <p>
             ':para' : nodeContent,
         },
         setFn(( node, ctx ) => {
             const {level} = node
             return mkComponent(({level,children, key })=>React.createElement(`h${level}`,{key}, children))
         })
     ),

    ':blankline': emptyContent(),
    ':para' : mkComponent('p'),
    'para' : mkComponent('div'),
    'comment:block': emptyContent(),
    'output': mkComponent(({children, key })=><pre key={key}><samp>{children}</samp></pre>),
    'input': mkComponent(({children, key })=><pre key={key}><kbd>{children}</kbd></pre>),

    // Directives 
    ':config': setFn(( node, ctx ) => {
        // setup context
        if ( ! ctx.hasOwnProperty('config') ) ctx.config = {}
        //collect configs in context
        ctx.config[node.name] = node.config
        return emptyContent()}),
    ':alias': setFn(( node, ctx ) => {
        // set alias
        if ( ! ctx.hasOwnProperty('alias') ) ctx.alias = {}
        //collect configs in context
        ctx.alias[node.name] = node.replacement
        return emptyContent()
    }),

    // Formatting codes
    'A<>': ( writer, processor ) => ( node, ctx, interator ) => {
        //get replacement text
        if (! (ctx.alias && ctx.alias.hasOwnProperty(node.content)) ) {
            return makeComponent(({children, key})=><code key={key}>A&lt;{children}&gt;</code>, node, node.content )
        } else {
            const src = ctx.alias[ node.content ].join('\n')
            const tree_1 = processor( src )
            // now clean locations
            const tree = clean_plugin()(tree_1)
            if ( tree[0].type === 'para') {
                return interator( tree[0].content, ctx )
            } else {
                return interator( tree, ctx )
            }
        }
    },
    'B<>': mkComponent('strong'),
    'C<>': mkComponent('code'),
    'E<>': ( writer, processor )=>( node, ctx, interator )=>{
        if ('content' in node  && Array.isArray(node.content) ) 
        return node.content.filter(e=>e && e.type == 'number').map(element=>{
            return String.fromCharCode(element.value)
        }).join('')
    },
    'I<>': mkComponent('i'),
    'K<>': mkComponent('kbd'),
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
            if ( !writer.hasOwnProperty('postInterator') ) { writer.postInterator = []}
  
            const FootNotes = makeComponent(({children, key})=><div key={`${key}_FOOTNOTES`} className="footnotes">
                {
                    footnotes.map((footnote, id) =>{
                        return <p key={id}>
                            <sup id={footnote.fnId} className="footnote"><a href={`#${footnote.fnRefId}`}>[{footnote.gid}]</a></sup>
                            { footnote.make() }
                        </p>
                     })
                }
            </div>,{})

           writer.postInterator.push( FootNotes )
           
        })
        return ( node, ctx, interator ) => {
            // skip empty notes
            if ( node.content.length < 1 ) { return }
            if ( !writer.hasOwnProperty('gid') ) { writer.gid = 1}
            // get foot note id
            const gid = writer.gid++
            const fnRefId = `fnref:${gid}`
            const fnId = `fn:${gid}`
            if ( !writer.hasOwnProperty('FOOTNOTES') ) { writer.FOOTNOTES = []}
            writer.FOOTNOTES.push({
                gid,
                fnRefId,
                fnId,
                node,
                make: ( )=>{ return interator(node.content, ctx) }
            })
            return makeComponent(({children, key})=><sup key={key} id={fnRefId} className="footnote"><a href={`#${fnId}`}>[{gid}]</a></sup> , node )
        }
    },
    'R<>': mkComponent('var'),
    'T<>':  mkComponent('samp'),
    'D<>':  ( writer, processor ) => ( node, ctx, interator ) => {
        
        let { synonyms } = node 
        let definition:string[] = [node.content[0]]
        if ( synonyms ) {
            definition = synonyms
        }

        if ( !writer.hasOwnProperty('DEFINITIONS') ) { writer.DEFINITIONS = []}
        writer.DEFINITIONS.push({ definition })
        return makeComponent('dfn', node,  interator(node.content, ctx))
     },
    "L<>": setFn(( node, ctx ) => {
        let { meta } = node
        if ( meta === null) {
            meta = node.content
        }
        return mkComponent(({children, key })=><a href={meta} key={key}>{children}</a>)
    }),
    'S<>' :( writer, processor )=>( node, ctx, interator )=>{
        const content = node.content || ''
        const Content = content.split('').map((symbol,index) => { 
            if (symbol === ' ') return "\u00a0";
            if (symbol === '\n') return <br key={index}/>;
            return symbol
        })
        return makeComponent(({children, key })=>children, {}, Content )
    },
    'V<>': nodeContent,
    'Z<>': emptyContent(),
    'U<>': mkComponent('u'),
    'X<>' : ( writer, processor ) => ( node, ctx, interator ) => {
        let {entry} =  node 
        if ( entry === null && node.content.length > 0) {
            //@ts-ignore
             entry = [node.content[0]]
        } 
        // else { return }
        if ( !writer.hasOwnProperty('INDEXTERMS') ) { writer.INDEXTERMS = []}
         writer.INDEXTERMS.push({
            entry
         })
         return interator(node.content, ctx)
     },
    // table section
    'table:block' : 
        ( writer, processor ) => 
                ( node, ctx, interator ) => 
                    {
                        const conf = makeAttrs(node, ctx)
                        let attr = {caption:''}
                        if ( conf.exists('caption') ) {
                                const caption = conf.getFirstValue('caption')
                                attr.caption = caption
                        }
                        if (  typeof node === 'string' ) {
                            return node
                        }
                        if (! ('content' in node) ) {
                            console.warn('[jsx] no content in node')
                            return ''
                        }
                        return makeComponent(({key, children})=>{
                                return <table key={key}>
                                    <caption>{attr.caption}</caption>
                                    <tbody>{children}</tbody></table>
                            }, node,  interator(node.content, { ...ctx}) )
                    }
    ,
    ':separator' :  emptyContent(),
    'table_row' :  mkComponent('tr'),
    'table_cell':  mkComponent('td'),
    'table_head' : subUse(
        { 
            'table_cell': mkComponent('th')
        },
        mkComponent('tr')
        ),
    ':list': setFn(( node, ctx ) => 
                node.list === 'ordered' ? mkComponent('ol') 
                                        : node.list ===  'variable' ? mkComponent('dl') 
                                                                    : mkComponent('ul')
                ),
    'item:block':  ( writer, processor ) => ( node, ctx, interator ) => {
        if (  typeof node === 'string' ) {
            return node
        }
        if (! ('content' in node) ) {
            console.warn('[jsx] no content in node')
            return ''
        }
        // make text from first para
        if (! (node.content instanceof Array)) {
            console.error(node)
        }
        return makeComponent('li', node, interator(node.content, { ...ctx}) )
    },

    }
}
function  podlite (children:string, { file,plugins=()=>{}, wrapElement}:{file?:string, plugins?:any, wrapElement?:WrapElement}, ...args) {
    const content = file
    const   ast = parse( children || content)
    let i_key_i = 10000
    const makeComponent = helperMakeReact({wrapElement})

    const rules:Rules = {
        ...mapToReact(makeComponent),
        ...plugins(makeComponent)
    }
    const writer = new Writer((s)=>{ 
    })
    const  res = 
    toAny({processor:parse})
    .use({'*:*':( writer, processor )=>( node, ctx, interator )=>{

        // skip named blocks
        if (isNamedBlock(node.name)) {
            return null
        }
        if ( isSemanticBlock(node) ) {
            return <><h1 className={node.name}>{node.name}</h1>
                    {interator(node.content, { ...ctx}) }
            </>

        }
        console.warn('[podlite] Not supported: ' + JSON.stringify(node,null,2))
        return React.createElement('code',{key:++i_key_i},`not supported node:${JSON.stringify(node,null,2)}`)
    }})
    .use(rules)
    .run(ast, writer)
// union main react elements and post processed via onEnd event
return new Array().concat( res.interator, writer.postInterator )
}
export default Podlite

