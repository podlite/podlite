import {  toTree, toHtml } from 'pod6';
import  toAny  from 'pod6/built/exportAny'
import { AstTree, Plugins, mkRootBlock, PodliteDocument } from '@podlite/schema';
export { mdToPod6 } from './md-to-pod6'
export  * from './tools'
import core from './plugins/core';
import externalPlugins  from './plugins/extrnal'


export interface PodliteOpt {
    importPlugins: boolean
}
export interface Podlite {
    (): any,
    use:(plugin:Plugins)=>Podlite,
    parse:(text:string, opt? : {skipChain:number, podMode:number})=>PodliteDocument,
    toHtml: (ast:PodliteDocument)=>string,
    toAst:  (ast:PodliteDocument)=>PodliteDocument,
    getPlugins: ()=>Array<Plugins>
}


export const toAnyRules =(method, allplugins:Plugins[])=>{ 
    // make uniq plugins
    const resultMap:Plugins = allplugins.reverse().reduce((result:Plugins, plugins:Plugins)=>{
        for ( const plugin of Object.entries(plugins) ) {
            const [ key, val ] = plugin
            if (!( key in result ) ) {
                result[key] = val 
            }
        }
        return result
    },<Plugins>{})

    let result = {}
    // prepare plugins for export <method>
    for ( const plugin of Object.entries(resultMap) ) { 
        const [ key, val ] = plugin
        if ( method in val ) {
            result[key] = val[method]
        }
    }
    return result
}

export const podlite = ({ importPlugins = true }:PodliteOpt):Podlite => {
    let instance= <Podlite>function(){}
    let plugins:Plugins[] = []
    
    
    instance.use = (onj:Plugins) =>{
        for ( const plugin of Object.entries(onj) ) {
            const [ key, val ] = plugin
            if ( typeof val  === 'function' ) {
                plugins.push( {[key]:{toAst:val}})
            } else {
                plugins.push( {[key]:val} )
            }
        }
        return instance
    }

    instance.parse = ( text, opt?) => { 
        const rawTree = toTree().parse(text, opt={skipChain: 0, podMode: 1})
        const root = mkRootBlock({margin:""}, rawTree)
        return root; 
    }

    instance.toAst = (ast) =>{
       // get plugins  for Ast
       const toAstPlugins= toAnyRules('toAst', instance.getPlugins())
       const result = toAny().use({
           '*':( )=>( node, ctx, interator )=>{ 
            if ( 'content' in node ) {
                node.content = interator(node.content, ctx)
            }
            return node
            }
       }).use(toAstPlugins).run(ast)
       return <PodliteDocument>result.interator
    }

    instance.toHtml = ( ast ) => { 
        const toHtmlPlugins= toAnyRules('toHtml', instance.getPlugins())
        return toHtml({}).use(toHtmlPlugins).run(ast,null)
    }

    instance.getPlugins = ()=>plugins

    // init core plugins
    instance.use( core )
    if (importPlugins) {
        instance.use( externalPlugins )
    }

    return instance

}
