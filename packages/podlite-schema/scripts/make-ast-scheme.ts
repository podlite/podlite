
import * as fs from 'fs'
import * as path from 'path'
import * as schema from './scheme'

const DIST_DIR = path.join(__dirname, '../')
const SCHEMA_DIST_DIR = path.join(DIST_DIR, 'schema')

function writeSchema(): void {
   Object.keys(schema).forEach((key) => {
       console.log(`processing schema ${key}`)
       const item = (schema as Record<string, unknown>)[key]

       fs.writeFileSync(
           path.join(SCHEMA_DIST_DIR, `${key}.json`),
           JSON.stringify(item, null, 4),
           {
               encoding: 'utf8',
           }
       )
   })
}

if (!fs.existsSync(SCHEMA_DIST_DIR)) {
   fs.mkdirSync(SCHEMA_DIST_DIR)
}
writeSchema()