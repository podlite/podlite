import { execFileSync } from 'child_process'
import { build } from 'esbuild'
import * as path from 'path'
import { cjsOptions } from '../scripts/build'

describe('the CommonJS entry', () => {
  it('bundles remark and unified but not the schema or what the schema depends on', async () => {
    const { metafile } = await build({ ...cjsOptions, write: false, metafile: true })
    const inputs = Object.keys(metafile?.inputs ?? {})
    expect(inputs.filter(input => /podlite-schema|node_modules\/(nanoid|json-pointer|ajv)\//.test(input))).toEqual([])
    expect(inputs.some(input => /node_modules\/unified\//.test(input))).toBe(true)
    expect(inputs.some(input => /node_modules\/remark-parse\//.test(input))).toBe(true)
  })

  it('builds the tree with the schema the application installed', () => {
    // the installed schema marks every block it makes; a copy built into the entry would not
    const script = `
const Module = require('module')
const load = Module._load
Module._load = function (name, ...rest) {
  const loaded = load.call(this, name, ...rest)
  if (name !== '@podlite/schema') return loaded
  return new Proxy(loaded, {
    get: (target, key) => (key === 'mkBlock' ? (...args) => ({ ...target.mkBlock(...args), installedSchema: true }) : target[key]),
  })
}
const { parseMd } = require(${JSON.stringify(path.join(__dirname, '../lib/index.cjs'))})
const marked = JSON.stringify(parseMd('# Head\\n')).includes('"installedSchema":true')
process.stdout.write(String(marked))
`
    expect(execFileSync('node', ['-e', script], { encoding: 'utf8' })).toBe('true')
  })
})
