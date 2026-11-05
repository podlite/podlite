import * as path from 'path'
import { build } from 'esbuild'
import { JSDOM } from 'jsdom'

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

  it('makes ids in a browser with the id pass of the core', async () => {
    const result = await build({
      stdin: {
        contents: [
          "import ids from './src/ids'",
          "import { mkBlock } from '@podlite/schema'",
          "window.__ids = () => ids()({ type: 'block', name: 'root', margin: '', content: [mkBlock({ name: 'para' }, []), mkBlock({ name: 'para' }, [])] }).content.map(block => block.id)",
        ].join('\n'),
        resolveDir: path.resolve(__dirname, '..'),
        loader: 'ts',
      },
      bundle: true,
      platform: 'browser',
      format: 'iife',
      write: false,
      metafile: true,
      logLevel: 'silent',
    })
    expect(Object.keys(result.metafile?.inputs ?? {}).some(input => input.endsWith('core/src/ids.ts'))).toBe(true)
    const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' })
    dom.window.eval(result.outputFiles[0].text)
    const made: string[] = JSON.parse(String(dom.window.eval('JSON.stringify(window.__ids())')))
    expect(made).toHaveLength(2)
    for (const id of made) expect(id).toMatch(/^[A-Za-z0-9_-]{21}$/)
    expect(made[0]).not.toBe(made[1])
  })
})
