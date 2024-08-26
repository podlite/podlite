import { getParserTypeforFile, parseFile, parseSources, processFile } from '../src/node-utils'
import { validatePodliteAst } from '@podlite/schema'
import { composePlugins, PluginConfig, PodliteWebPlugin, processPlugin } from '../src'
it('process files', () => {
  const glob = require('glob')
  const arr = glob.sync('packages/podlite-publisher/t/test-blog.pub/*')
  expect(arr.length).toEqual(2)
})
it('detect parser type', () => {
  expect(getParserTypeforFile('somefile.txt')).toEqual('default')
  expect(getParserTypeforFile('somefile.pod6')).toEqual('podlite')
  expect(getParserTypeforFile('somefile.podlite')).toEqual('podlite')
  expect(getParserTypeforFile('somefile.md')).toEqual('markdown')
  expect(getParserTypeforFile('somefile.markdown')).toEqual('markdown')
  expect(getParserTypeforFile('somefile.tsx')).toEqual('default')
})

it('detect0 parser type by mime', () => {
  expect(getParserTypeforFile('somefile.txt', 'text/markdown')).toEqual('markdown')
  expect(getParserTypeforFile('somefile.txt', 'text/podlite')).toEqual('podlite')
})

it('parse podlite file 1', () => {
  const p = parseFile('packages/podlite-publisher/t/test-parse/file.pod6')
  const r = validatePodliteAst(p)
  expect(r).toEqual([])
})
it('parse podlite file 2', () => {
  const p = parseFile('packages/podlite-publisher/t/test-parse/file.podlite')
  const r = validatePodliteAst(p)
  expect(r).toEqual([])
})
it('parse default file: ', () => {
  const p = parseFile('packages/podlite-publisher/t/test-parse/main.ts')
  const r = validatePodliteAst(p)
  expect(r).toEqual([])
})
it('parse markdown file', () => {
  const p = parseFile('packages/podlite-publisher/t/test-parse/text.md')
  const r = validatePodliteAst(p)
  expect(r).toEqual([])
})

it('parse Source:  markdown file', () => {
  const [p] = parseSources('packages/podlite-publisher/t/test-parse/text.md')
  //validate podlite
  const r = validatePodliteAst(p.node)
  expect(r).toEqual([])
  const { node, ...rest } = p
  expect(rest).toMatchInlineSnapshot(`
    Object {
      "author": Array [
        "Author One",
        "Author Two",
      ],
      "description": "This is the abstract.

    It consists of two paragraphs.
    ",
      "file": "packages/podlite-publisher/t/test-parse/text.md",
      "footer": undefined,
      "pubdate": 2024-08-02T12:34:56.000Z,
      "publishUrl": "/about",
      "sources": Array [],
      "subtitle": undefined,
      "title": "My article",
      "type": "page",
    }
  `)
})

it('parse Source:  typescript file', () => {
  const [p] = parseSources('packages/podlite-publisher/t/test-parse/main.ts')
  //validate podlite
  const r = validatePodliteAst(p.node)
  expect(r).toEqual([])
  const { node, ...rest } = p
  expect(rest).toMatchInlineSnapshot(`
    Object {
      "author": undefined,
      "description": "",
      "file": "packages/podlite-publisher/t/test-parse/main.ts",
      "footer": "",
      "pubdate": undefined,
      "publishUrl": undefined,
      "sources": Array [],
      "subtitle": undefined,
      "title": "",
      "type": "page",
    }
  `)
})

it('parse Source:  podlite file', () => {
  const [p] = parseSources('packages/podlite-publisher/t/test-parse/note.podlite')
  //validate podlite
  const r = validatePodliteAst(p.node)
  expect(r).toEqual([])
  const { node, ...rest } = p
  expect(rest).toMatchInlineSnapshot(`
    Object {
      "author": undefined,
      "description": "",
      "file": "packages/podlite-publisher/t/test-parse/note.podlite",
      "footer": "",
      "pubdate": undefined,
      "publishUrl": undefined,
      "sources": Array [],
      "subtitle": undefined,
      "title": "The Last of the Mohicans
    ",
      "type": "page",
    }
  `)
})

// now lets make pipe tp process files

it('processPlugin: run plugin using config', () => {
  const items = parseSources('packages/podlite-publisher/t/test-parse/*')
  const testPlugin = ({ title = 'processed' }): PodliteWebPlugin => {
    return [
      items => {
        return items.map(i => ({ ...i, title }))
      },
      ctx => ctx,
    ]
  }

  const config1: PluginConfig = {
    plugin: testPlugin({ title: 'test_title' }),
    includePatterns: '.*',
    excludePatterns: 'dir1/mod1',
  }

  expect(processPlugin(config1, items)[0].map(i => i.title)).toMatchInlineSnapshot(`
    Array [
      "test_title",
      "test_title",
      "test_title",
      "test_title",
      "test_title",
    ]
  `)
  const config2: PluginConfig = {
    plugin: testPlugin({ title: 'test_title' }),
    includePatterns: '.*',
    excludePatterns: 'dir1/mod1',
  }

  expect(processPlugin(config2, items)[0].map(i => i.title)).toMatchInlineSnapshot(`
    Array [
      "test_title",
      "test_title",
      "test_title",
      "test_title",
      "test_title",
    ]
  `)
})
it('composePlugins: conpose several configs into one plugin', () => {
  const testPlugin = ({ title = 'processed' }): PodliteWebPlugin => {
    return [
      items => {
        return items.map(i => ({ ...i, title }))
      },
      ctx => ({ ...ctx, ...{ testPlugin: 1 } }),
    ]
  }
  const upperCaseFied = ({ field = 'title' }): PodliteWebPlugin => {
    return [
      items => {
        return items.map(i => {
          const newItem = { ...i }
          newItem[field] = newItem[field].toUpperCase()
          return newItem
        })
      },
      ctx => ({ ...ctx, ...{ upperCaseFied: 1 } }),
    ]
  }

  const config1: PluginConfig = {
    plugin: testPlugin({ title: 'TEST_title' }),
    includePatterns: '.*',
    excludePatterns: 'dir1/mod1',
  }
  const config2: PluginConfig = {
    plugin: upperCaseFied({ field: 'title' }),
    includePatterns: '.*',
    excludePatterns: 'dir1/mod1',
  }

  // return result
  const configComposed = composePlugins([config1, config2])
  const file1 = `
=begin pod 
sdsd
=end pod
`
  const files = [processFile('virtual/src.pod6', file1)]
  const [res, ctx] = processPlugin(configComposed, files, {})
  expect(ctx).toMatchInlineSnapshot(`
    Object {
      "testPlugin": 1,
      "upperCaseFied": 1,
    }
  `)
})
