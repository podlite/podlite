import Ajv, { ErrorObject, JSONSchemaType } from 'ajv'
import * as pointer from 'json-pointer'
import { AstTree } from './types'
export { AstTree } from './types'
export * from './types'
export * from './blocks-helpers'

export function toAst () {
    return {}
}

export type SchemaValidationError = ErrorObject<string, Record<string, any>>
const ajv = new Ajv({strict: true, allowUnionTypes: true})
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



