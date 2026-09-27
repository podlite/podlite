import * as path from 'path'
import { build } from 'esbuild'

describe('the include assembly entry', () => {
  it('bundles for a browser with no module of Node in it', async () => {
    const result = await build({
      entryPoints: [path.resolve(__dirname, '../src/assemble/index.ts')],
      bundle: true,
      platform: 'browser',
      write: false,
      logLevel: 'silent',
    })
    expect(result.errors).toEqual([])
    expect(result.outputFiles[0].text).not.toMatch(/require\(["'](fs|path|node:[a-z]+)["']\)/)
  })
})
