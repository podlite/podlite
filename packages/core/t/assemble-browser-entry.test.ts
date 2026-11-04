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

  it('makes ids in a browser once it is loaded', async () => {
    // loading alone runs no id: the generator runs when a block is made
    const result = await build({
      stdin: {
        contents:
          "import { mkBlock } from '@podlite/schema'; import './src/assemble/index'; window.__ids = () => [mkBlock({ name: 'para' }, []).id, mkBlock({ name: 'para' }, []).id]",
        resolveDir: path.resolve(__dirname, '..'),
        loader: 'ts',
      },
      bundle: true,
      platform: 'browser',
      format: 'iife',
      write: false,
      logLevel: 'silent',
    })
    const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only' })
    dom.window.eval(result.outputFiles[0].text)
    const [first, second]: string[] = JSON.parse(String(dom.window.eval('JSON.stringify(window.__ids())')))
    expect(first).toMatch(/^[A-Za-z0-9_-]{21}$/)
    expect(first).not.toBe(second)
  })
})
