import { getPublishAttributes, parseSources, processFile } from '../src/node-utils'
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

describe('a title with hidden words', () => {
  const published = (source: string) => {
    const item = processFile('virtual/hidden.podlite', source)
    const [res] = processPlugin({ plugin: pubdatePlugin(), includePatterns: '.*' }, [item], {})
    return res
  }

  it('masks the hidden word of an article and leaves it out of the address', () => {
    const [article] = published(
      "=begin pod\n=for head1 :pubdate('2024-01-01T12:00:00Z')\nPlan G<Zeta>\n=para Text of the article.\n=end pod\n",
    )
    expect(article.title).toBe('Plan ████')
    expect(article.publishUrl).toBe('/2024/1/1/1/plan')
  })

  it('gives an article with a fully hidden title an address without a name', () => {
    const [article] = published(
      "=begin pod\n=for head1 :pubdate('2024-01-02T12:00:00Z')\nG<All hidden>\n=para Text of the article.\n=end pod\n",
    )
    expect(article.title).toBe('███ ██████')
    expect(article.publishUrl).toBe('/2024/1/2/1')
  })

  it('masks the title of a document published without an address of its own', () => {
    const [page] = published("=begin pod :pubdate('2024-01-03T12:00:00Z')\n=TITLE Plan G<Zeta>\n\nText.\n=end pod\n")
    expect(page.title.trim()).toBe('Plan ████')
    expect(page.publishUrl).toBe('/2024/1/3/1/plan')
  })

  it('masks the title and the subtitle a page is given', () => {
    const item = processFile(
      'virtual/page.podlite',
      '=begin pod\n=TITLE Site G<Internal>\n=SUBTITLE Notes on G<Bastion>\n=end pod\n',
    )
    const { title, subtitle } = getPublishAttributes(item.node)
    expect(title.trim()).toBe('Site ████████')
    expect(subtitle.trim()).toBe('Notes on ███████')
  })

  it('masks the title a record is read with', () => {
    const item = processFile('virtual/record.podlite', '=begin pod\n=TITLE Project G<Aurora>\n=end pod\n')
    expect(item.title.trim()).toBe('Project ██████')
  })
})
