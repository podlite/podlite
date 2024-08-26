import { parseSources, processFile } from '../src/node-utils'
import { PluginConfig, processPlugin } from '../src'
import pubdatePlugin, { getArticles, getNotes, getPages } from '../src/pubdate-plugin'

it('pubdatePlugin: skip items without pubdate', () => {
  const items = parseSources('packages/podlite-publisher/t/pubdate-plugin/private.podlite')
  expect(items.length).toEqual(1)
  const config: PluginConfig = {
    plugin: pubdatePlugin(),
    includePatterns: '.*',
  }
  const [res, ctx] = processPlugin(config, items, {})
  expect(res.length).toEqual(0)
})

it('make pipe depends on config', () => {
  const items = parseSources('packages/podlite-publisher/t/pubdate-plugin/two_articles.podlite')
  const config: PluginConfig = {
    plugin: pubdatePlugin(),
    includePatterns: '.*',
    excludePatterns: 'dir1/mod1',
  }
  const [res, ctx] = processPlugin(config, items, {})
  expect(res.length).toEqual(0)
})

it('pubdatePlugin: extract articles', () => {
  const items = parseSources('packages/podlite-publisher/t/pubdate-plugin/extract_articles.podlite')
  expect(items.length).toEqual(1)
  const res = getArticles(items[0])
  expect(res.length).toEqual(2)
  // check if all articles have pubdate and title, type
  const result = res.map(({ title, pubdate, type }) => ({ title, pubdate, type }))
  expect(result).toMatchInlineSnapshot(`
    Array [
      Object {
        "pubdate": "2024-08-01",
        "title": "NAME 1",
        "type": "page",
      },
      Object {
        "pubdate": "2024-08-02",
        "title": "NAME 2",
        "type": "page",
      },
    ]
  `)
})
it('pubdatePlugin: extract notes', () => {
  const items = parseSources('packages/podlite-publisher/t/pubdate-plugin/extract_articles.podlite')
  expect(items.length).toEqual(1)
  const res = getNotes(items[0])
  expect(res.length).toEqual(3)
  // check if all articles have pubdate and title, type
  const result = res.map(({ pubdate, type }) => ({ pubdate, type }))
  expect(result).toMatchInlineSnapshot(`
    Array [
      Object {
        "pubdate": "2024-08-03T12:00:01Z",
        "type": "note",
      },
      Object {
        "pubdate": "2024-08-03T12:00:02Z",
        "type": "note",
      },
      Object {
        "pubdate": "2024-08-03T12:00:03Z",
        "type": "note",
      },
    ]
  `)
})

it('pubdatePlugin: extract 0 pages', () => {
  const items = parseSources('packages/podlite-publisher/t/pubdate-plugin/extract_articles.podlite')
  expect(items.length).toEqual(1)
  const res = getPages(items[0])
  expect(res.length).toEqual(0)
})
it('pubdatePlugin: extract 2 pages', () => {
  const items = parseSources('packages/podlite-publisher/t/pubdate-plugin/two_pages.podlite')
  expect(items.length).toEqual(1)
  const res = getPages(items[0])
  expect(res.length).toEqual(2)
  // check if all articles have pubdate and title, type
  const result = res.map(({ pubdate, type, publishUrl, title }) => ({ title, pubdate, type, publishUrl }))
  expect(result).toMatchInlineSnapshot(`
    Array [
      Object {
        "pubdate": "2024-06-01",
        "publishUrl": "",
        "title": "NAME OF THE PROGRAM 1
    ",
        "type": "page",
      },
      Object {
        "pubdate": "2024-06-02",
        "publishUrl": "http://example.com",
        "title": "NAME OF THE PROGRAM 2
    ",
        "type": "page",
      },
    ]
  `)
})

it('pubdatePlugin: fill up publish url', () => {
  const tmpDate = new Date()
  tmpDate.setDate(tmpDate.getDate() + 10 /* days */)
  const dataInFuture = tmpDate.toISOString()
  const additinalItems = processFile(
    't/pubdate-plugin/subset2.virtualFile.podlite',
    `
=begin pod :pubdate('${dataInFuture}')
=TITLE This date will be a little bit sunny

This is a test para

=end pod
`,
  )
  const items = [...parseSources('packages/podlite-publisher/t/pubdate-plugin/subset2.*'), additinalItems]
  expect(items.length).toEqual(3)
  const config: PluginConfig = {
    plugin: pubdatePlugin(),
    includePatterns: 't/pubdate-plugin/subset2.*',
    excludePatterns: 'dir1/mod1',
  }
  const [res, ctx] = processPlugin(config, items, {})
  expect(res.length).toEqual(3)

  const result = res.map(({ pubdate, type, publishUrl, title, sources }) => ({
    title,
    pubdate,
    type,
    publishUrl,
    sources,
  }))
  expect(result).toMatchInlineSnapshot(`
    Array [
      Object {
        "pubdate": "2024-06-01T13:00:00",
        "publishUrl": "/2024/6/1/1/this-date-was-a-little-bit-sunny",
        "sources": Array [
          "/a5XF1",
        ],
        "title": "This date was a little bit sunny
    ",
        "type": "a",
      },
      Object {
        "pubdate": "2024-06-01T14:04:00",
        "publishUrl": "/2024/6/1/2",
        "sources": Array [
          "/n5XF1",
        ],
        "title": null,
        "type": "n",
      },
      Object {
        "pubdate": "2024-06-01",
        "publishUrl": "/about",
        "sources": Array [],
        "title": "Static Page
    ",
        "type": "page",
      },
    ]
  `)
  expect(ctx).toHaveProperty('nextPublishTime')
})
