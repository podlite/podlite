import Ajv, { ErrorObject, JSONSchemaType } from 'ajv'
import * as pointer from 'json-pointer'
import makeTransformer from 'pod6/built/helpers/makeTransformer'
import { AstTree, PodliteDocument } from './types'
export { AstTree } from './types'
export * from './types'
export * from './blocks-helpers'

export function toAst () {
    return {}
}

export type SchemaValidationError = ErrorObject<string, Record<string, any>>
const ajv = new Ajv({strict: true, allowUnionTypes: true})
/**
 * Get nodes by queries
 * @param tree 
 * @param queries 
 * @returns array of matched nodes
 */
export const getFromTree = (tree:PodliteDocument, ...queries: string[]) => { 
    let results = []
    let rules = {}
    for ( let rule of queries ) {
        rules[rule] = (n, ctx, visiter) => { 
            results.push(n);
            if ( 'content' in n ) {
                return { n, content: transformer(n.content, { ...ctx } ) }
            }
        }
    }
    const transformer = makeTransformer(rules)
    transformer(tree, {})
    return results
}

export function  validatePodliteAst(data:unknown ):SchemaValidationError[] { return  validateAst(data,'PodliteDocument.json') }

export function validateAst( data:unknown, Name:string = 'AstTree.json'):SchemaValidationError[] {
    const AstTreeSchema: JSONSchemaType<AstTree> = require( `../schema/${Name}`)
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



