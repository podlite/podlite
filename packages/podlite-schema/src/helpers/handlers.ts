import { makeRule, makeRulesArray, RuleObject,RuleHandler } from './makeQuery'
import makeInterator from './makeInterator'
import  makeAttrs  from './config'

/**
 * wrap content by open and closed tags
 */
export const wrapContent = 
    ( pre, post ):RuleHandler => 
        ( writer, processor ) => 
            ( node, ctx, interator )=>
                {
                    writer.writeRaw(pre) 
                    if (node.content) interator( node.content, ctx )
                    writer.writeRaw(post) 
                }
/**
 * emptyContent - skip any child node
 */
export const emptyContent = ():RuleHandler => () => ()=>{}
/**
 * content - process childs as regular content 
 */
export const content:RuleHandler = ( writer, processor )=>( node,ctx, interator )=>{ 
    if ( node.content ) {
        return interator(node.content, ctx) 
    }
}

/** 

Set hander after call with node

':para':setFn((node,ctx) => (ctx.parents || [] ).includes('head') ? content : wrapContent('<p>','</p>'),

*/
export const setFn = ( check ):RuleHandler => ( writer, processor ) => {
    return ( node, ctx, interator ) =>{
        return check( node, ctx )( writer, processor )( node, ctx, interator )
    }
}

/** 

Set new context for handler 

        const parents = (ctx.parents || [])
        parents.push('head')
        const {level} = node
        return setContext( { ...ctx, parents }, wrapContent(`<h${level}>`,`</h${level}>`))

*/

export const setContext = ( ctx, fn ):RuleHandler => ( writer, processor ) => {
    return ( node, _, interator ) => {
        return fn( writer, processor )( node, ctx, interator )
       }
}

/**
 * Select handler from already inited wrappers
 * 
 * @param {*} check 
 * @param  {...any} fns 
 */
const IfNode = ( check, ...fns ):RuleHandler => ( writer, processor ) => {
    return ( node, ctx, interator ) =>{
        check( node, ctx, ...fns.map( i => i( writer, processor ) ) )( node, ctx, interator )
    }
}

/**
 * Make subset of rules for processing
 * 
 * @param {*} rules 
 * @param {*} processNode 
 */
export const subUse = ( rules:RuleObject|Array<RuleObject>, processNode ):RuleHandler => {
    const newFns = makeRulesArray(rules).reverse()
    return ( writer, processor ) => {
        // init new rules
        const inited = newFns.map(
                                    item=>makeRule( item.rule, item.fn( writer, processor ) ) 
                                ).reverse()
        const processNodeInited = processNode( writer, processor )
        let subInterator ;
        return ( node, ctx, interator ) => {
            if ( !subInterator ) subInterator = makeInterator([ ...interator.rules, ...inited ])
            return processNodeInited( node, ctx, subInterator )
        }
     }
}

/**
 * Add support nesting 
 * 
 * @param {*} rules 
 * @param {*} implicitLevel - default level of nesting 
 *  
 */

export const handleNested = ( defaultHandler:RuleHandler, implicitLevel?:number ):RuleHandler => {
    return ( writer, processor ) => {

        const defaultHandlerInited = defaultHandler( writer, processor )
        
        return ( node, ctx, interator ) => {

                const nesting = makeAttrs(node, ctx).getFirstValue('nested') || implicitLevel
                
                // add nesting level
                if ( nesting !== undefined ) {
                    writer.addLevel(nesting)
                }

                defaultHandlerInited( node, ctx, interator )

                // remove nesting level
                if ( nesting !== undefined ) {
                    writer.removeLevel(nesting)
                }

        }
     }
}
