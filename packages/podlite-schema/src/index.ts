import Ajv, { ErrorObject, JSONSchemaType } from 'ajv'
import * as pointer from 'json-pointer'
import makeTransformer from 'pod6/built/helpers/makeTransformer'
import { AstTree, PodliteDocument } from './types'
import * as  jsonShemes  from '../schema'
export { AstTree } from './types'
export * from './types'
export * from './blocks-helpers'

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
    const transformer = makeTransformer(rules)
    const res = transformer(node, {})
    return text
}

export function  validatePodliteAst(data:unknown ):SchemaValidationError[] { return  validateAst(data,'PodliteDocument') }

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



