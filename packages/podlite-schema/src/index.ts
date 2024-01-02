import Ajv, { ErrorObject, JSONSchemaType } from 'ajv'
import * as pointer from 'json-pointer'
import { AstTree, PodNode } from './types'
import * as  jsonShemes  from '../schema'
import { makeInterator } from './ast-inerator'
export { AstTree } from './types'
export * from './types'
export * from './blocks-helpers'
export * from './query-helpers'
export * from './ast-helpers'
export * from './helpers/handlers'

export {makeInterator} from './ast-inerator'
export {makeTransformer, isNamedBlock , isSemanticBlock } from './helpers/makeTransformer'
export {toAny} from './exportAny'
export {makeAttrs} from './helpers/config'
export {pluginCleanLocation} from './plugin-clean-location'

// @ts-ignore
import * as parser from './grammar'
import vmargin_plug from './plugin-vmargin'
import formattingCodes_plug  from  './plugin-formatting-codes'
import itemsNumbering_plug from './plugin-items' 
import heading_plug from './plugin-heading'
import defnGroup_plug from  './plugin-group-defn'
import itemsGroup_plug from './plugin-group-items'
import defnTerms_plug from './plugin-defn-fill-term'
import table_plug from './plugin-tables'

export function toAst () {
    return {}
}

export type SchemaValidationError = ErrorObject<string, Record<string, any>>
const ajv = new Ajv({strict: true, allowUnionTypes: true})

export function getTextContentFromNode(node: PodNode) {
    let text = ''
    const rules = {
        ":text": (node)=>{
            text +=node.value
        },
        ":verbatim": (node)=>{
            text +=node.value
        },
    }
    const transformer = makeInterator(rules)
    const res = transformer(node, {})
    return text
}

export function  validatePodliteAst(data:unknown ):SchemaValidationError[] { return  validateAst(data,'PodliteDocument') }
export function  validateAstTree(data:unknown ):SchemaValidationError[] { return  validateAst(data,'AstTree') }

export function validateAst( data:unknown, Name:string = 'AstTree'):SchemaValidationError[] {
    const AstTreeSchema: JSONSchemaType<AstTree> =  jsonShemes[Name] 
    if (!AstTreeSchema) {
        console.warn(`[validateAst] Can't exists ${Name} scheme.`)
    }
    
	const validate = ajv.compile<AstTree>(AstTreeSchema)
	if (validate(data)) {
		return []
	}
	return validate.errors || []

}

export function isValidateError (result:SchemaValidationError[],src:any):any {
    if ( result.length  > 0 ) {
        // get most erorred dataPath
        let errors_by_path = {}
        const reducer = ( acc, value) => {
            acc[value.dataPath] = ( acc[value.dataPath] || 0 ) + 1; 
            return acc
        }
        const pathMap = result.reduce(reducer, errors_by_path)
        const mostlyError =  (Object.keys(pathMap).sort( (a,b) => pathMap[b]-pathMap[a] ) || [] )[0]
        return  pointer.get(src, mostlyError)
  }
  return undefined
}
export interface Test  {
    ters:string
}

export interface nBlock {
    "type":"block",
     name: "pod",
     content:AST,
     margin: string,
    // [name : string]:string,
}
export interface  nCode   {
    "type": "code",
    "content": [],
    "name": string,
    "margin": string,
    "config": [],
    "text": string
}

export interface  nText   {
    "type": "text",
    "content": [],
    "name": string,
    "margin": string,
    "config": [],
    'value':string,
}

export interface  nPara   {
    "type": "para",
    "content": [],
    "name": string,
    "margin": string,
    "config": []
}

export interface nVerbatim  { type:'verbatim', value:string, "margin": string, "text": string}
export type Node = nBlock| nCode | nText| nPara | nVerbatim;
export type AST = Array<Node>
export type ParserPlugin = ( opt : {
    skipChain: number;
    podMode: number;
} ) => ( param:AST ) => AST
function makeTree () {
    var plugins:Array<ParserPlugin> = []
    chain.use = use
    chain.parse = parse
    chain.use( vmargin_plug )
    chain.use( itemsNumbering_plug )
    chain.use( heading_plug )
    chain.use( defnTerms_plug )
    chain.use(table_plug)
    chain.use( formattingCodes_plug )
    
    // save order for the next two plugins
    chain.use( itemsGroup_plug )
    chain.use( defnGroup_plug )
    return chain

    function chain() {
        return 
    }

    function use( plugin :ParserPlugin ) {
        if ( ! ["function"].includes(typeof plugin) ) {
            throw(plugin)
            }

        plugins.push( plugin )
        return chain
    }
    
    function parse ( src:string , opt = {skipChain:0, podMode:1} ) {
        let tree : AST = parser.parse( src ,{podMode:opt.podMode})
        if ( !opt.skipChain ) {
           
            for ( let i = 0 ; i < plugins.length; i++ ) {
                const plugin = plugins[i]
                // init
                const visitor = plugin( opt )
                // process tree
                tree = visitor( tree )
            }
        }
        return tree
    }
}

export {makeTree as toTree}
const parse: Function = makeTree().parse
export { parse as parse } 
export { default as toHtml } from './exportHtml'
export { default as Writer } from './writer'
// Cannot be `import` as it's not under TS root dir
// https://stackoverflow.com/questions/51070138/how-to-import-package-json-into-typescript-file-without-including-it-in-the-comp

const {version: VERSION} = require('../package.json');
export { VERSION as version} 


