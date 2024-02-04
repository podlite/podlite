import * as path from 'path'
import * as TJS from 'typescript-json-schema'

const settings: TJS.PartialArgs = {
  required: true,
  // noExtraProps: true,
}
const compilerOptions: TJS.CompilerOptions = {
  strictNullChecks: true,
}
const basePath = path.join(__dirname, '../lib')

const program = TJS.getProgramFromFiles(
  [path.resolve('lib/index.d.ts'), path.resolve('lib/types.d.ts')],
  compilerOptions,
  basePath,
)

const generator = TJS.buildGenerator(program, settings)
export const Test = generator?.getSchemaForSymbol('Test')
export const AstTree = generator?.getSchemaForSymbol('AstTree')
export const PodliteDocument = generator?.getSchemaForSymbol('PodliteDocument')
