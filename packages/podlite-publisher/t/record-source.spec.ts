import * as fs from 'fs'
import prettyFormat from 'pretty-format'
import { frozenIds, mkRootBlock } from '@podlite/schema'
import * as main from '../src'
import * as nodeEntry from '../src/node'
import { PluginConfig, processPlugin, isParsedTree, recordOrigin, recordSource } from '../src'
import { parseSources, parseText, processFile } from '../src/node'
import { buildPagesIndex } from '../src/dump-pages-plugin'
import imagesPlugin from '../src/images-plugin'
import linksPlugin from '../src/links-plugin'
import pubdatePlugin, { getArticles, getNotes, getPages } from '../src/pubdate-plugin'
import reactPlugin from '../src/react-plugin'
import siteDataPlugin from '../src/site-data-plugin'

const tctx = { testing: true }
const text = `
=begin pod :puburl</doc>

=TITLE Documentation

A paragraph.

=end pod
`
const run = (plugin, records) => {
  const config: PluginConfig = { plugin, includePatterns: '.*' }
  return processPlugin(config, records, tctx)[0]
}
const same = (a, b) => expect(frozenIds()(a)).toEqual(frozenIds()(b))

it('a record read from a text gives that text, its name and its type', () => {
  const record = processFile('virtual/doc.txt', text, 'text/podlite')
  const source = recordSource(record)
  expect(source?.text).toBe(text)
  expect(source?.file).toBe('virtual/doc.txt')
  expect(source?.mime).toBe('text/podlite')
  expect(isParsedTree(record)).toBe(true)
})

it('a record read from disk gives the text of the file', () => {
  const file = 'packages/podlite-publisher/t/test-blog.pub/two_articles.pod6'
  const [record] = parseSources(file)
  expect(recordSource(record)?.text).toBe(fs.readFileSync(file).toString())
})

it('the source of a markdown record keeps the front matter', () => {
  const file = 'packages/podlite-publisher/t/test-parse/text.md'
  const [record] = parseSources(file)
  const source = recordSource(record)
  expect(source?.text.startsWith('---\n')).toBe(true)
  same(parseText(file, source?.text || ''), record.node)
})

it('parseText reads the source again into the same tree', () => {
  const podlite = processFile('virtual/doc.podlite', text)
  same(parseText('virtual/doc.podlite', recordSource(podlite)?.text || ''), podlite.node)
  const typed = processFile('virtual/doc.txt', text, 'text/podlite')
  const source = recordSource(typed)
  same(parseText('virtual/doc.txt', source?.text || '', source?.mime), typed.node)
})

it('parseText takes an empty text as given', () => {
  expect(parseText('virtual/none.podlite', '').content).toEqual([])
})

it('a copy of the record keeps the source', () => {
  const record = processFile('virtual/doc.podlite', text)
  const source = recordSource(record)
  expect(source).toBeDefined()
  expect(recordSource({ ...record })).toBe(source)
  expect(recordSource(Object.assign({}, record, { publishUrl: '/x' }))).toBe(source)
  expect(isParsedTree({ ...record })).toBe(true)
})

it('two readings of one text have two sources', () => {
  const a = processFile('virtual/doc.podlite', text)
  const b = processFile('virtual/doc.podlite', text)
  expect(recordSource(a)).toBeDefined()
  expect(recordSource(a)).not.toBe(recordSource(b))
})

it('records read under one name give each its own text', () => {
  const texts = ['=para one\n', '=para two\n', '=para three\n']
  const records = texts.map(t => processFile('virtual/same.podlite', t))
  expect(records.map(r => recordSource(r)?.text)).toEqual(texts)
})

it('a plugin that walks the tree leaves the source and replaces the tree', () => {
  const record = processFile('virtual/doc.podlite', text)
  const source = recordSource(record)
  const plugins = [reactPlugin(), imagesPlugin(), linksPlugin()]
  const [walked] = plugins.reduce((records, plugin) => run(plugin, records), [record])
  expect(source).toBeDefined()
  expect(recordSource(walked)).toBe(source)
  expect(isParsedTree(walked)).toBe(false)
  same(walked.node, record.node)
})

it('a record given another tree keeps the source and is no longer the parsed one', () => {
  const record = processFile('virtual/doc.podlite', text)
  const changed = { ...record, node: mkRootBlock({}, []) }
  expect(recordSource(changed)).toBe(recordSource(record))
  expect(recordSource(changed)).toBeDefined()
  expect(isParsedTree(changed)).toBe(false)
})

it('a record built by hand has neither source nor origin', () => {
  const record = processFile('virtual/doc.podlite', text)
  const built = { file: record.file, node: record.node }
  expect(recordSource(record)).toBeDefined()
  expect(recordSource(built)).toBeUndefined()
  expect(recordOrigin(built)).toBeUndefined()
  expect(isParsedTree(built)).toBe(false)
})

describe('records cut out by the pubdate plugin', () => {
  const pages = `
=begin pod :pubdate('2024-01-01 10:00') :puburl</a>
=TITLE A
=end pod

=begin pod :pubdate('2024-01-02 10:00') :puburl</b>
=TITLE B
=end pod
`
  const journal = `
=begin pod
=for head1 :pubdate('2024-01-01 10:00')
Article

Body.

=for para :pubdate('2024-01-02 10:00')
A note.

=end pod
`
  it('pages of one file share an origin and have no source of their own', () => {
    const record = processFile('virtual/two.podlite', pages)
    const [a, b] = getPages(record)
    expect(recordSource(record)).toBeDefined()
    expect(recordSource(a)).toBeUndefined()
    expect(recordSource(b)).toBeUndefined()
    expect(recordOrigin(a)).toBe(recordSource(record))
    expect(recordOrigin(b)).toBe(recordSource(record))
    expect(isParsedTree(a)).toBe(false)
  })

  it('articles and notes carry the origin', () => {
    const record = processFile('virtual/journal.podlite', journal)
    const cut = [...getArticles(record), ...getNotes(record)]
    expect(cut.length).toBe(2)
    expect(recordSource(record)).toBeDefined()
    cut.forEach(item => {
      expect(recordSource(item)).toBeUndefined()
      expect(recordOrigin(item)).toBe(recordSource(record))
    })
  })

  it('a record cut from a cut record keeps the first origin', () => {
    const record = processFile('virtual/two.podlite', pages)
    const [page] = getPages(record)
    const [again] = getPages(page)
    expect(recordOrigin(again)).toBeDefined()
    expect(recordOrigin(again)).toBe(recordSource(record))
  })

  it('the plugin as a whole keeps the origin', () => {
    const record = processFile('virtual/two.podlite', pages)
    const published = run(pubdatePlugin(), [record])
    expect(published.length).toBe(2)
    expect(recordSource(record)).toBeDefined()
    published.forEach(item => expect(recordOrigin(item)).toBe(recordSource(record)))
  })
})

it('the source stays out of what is written and out of the keys', () => {
  const record = processFile('virtual/doc.podlite', text)
  expect(recordSource(record)?.text).toBe(text)
  const written = JSON.stringify(text).slice(1, -1)
  const named = Object.fromEntries(Object.entries(record))
  expect(JSON.stringify(record)).toBe(JSON.stringify(named))
  expect(JSON.stringify(record)).not.toContain(written)
  expect(JSON.stringify(buildPagesIndex([record], [{ offset: 0, length: 1 }]))).not.toContain(written)
  expect(Object.keys(record)).toEqual([
    'type',
    'isPage',
    'title',
    'description',
    'subtitle',
    'author',
    'footer',
    'publishUrl',
    'pubdate',
    'file',
    'sources',
    'node',
  ])
})

it('a printed record shows where it was read from and not the text', () => {
  const record = processFile('virtual/doc.txt', text, 'text/podlite')
  const { node, ...rest } = record
  const printed = prettyFormat(rest)
  expect(printed).toContain('"file": "virtual/doc.txt"')
  expect(printed).toContain('"mime": "text/podlite"')
  expect(printed).toContain('Symbol(@podlite/publisher:source/1)')
  expect(printed).not.toContain('=begin pod')
})

it('the site data document has a source', () => {
  const index = processFile(
    'virtual/index.podlite',
    `=begin pod :puburl</> :pubdate('2024-01-01 10:00')\n=TITLE Index\n=end pod\n`,
  )
  const records = run(
    siteDataPlugin({ public_path: '/tmp/public', indexFilePath: 'virtual/index.podlite', built_path: '/built' }),
    [index],
  )
  const data = records.find(r => r.file === 'virtual/site-data-plugin.podlite')
  expect(data).toBeDefined()
  const source = data && recordSource(data)
  expect(source?.text).toContain('=for NAME  :id<PLUGIN_DATA>')
})

it('the entries of the package give the readers and keep the writers inside', () => {
  expect(Object.keys(main)).toEqual(expect.arrayContaining(['recordSource', 'recordOrigin', 'isParsedTree']))
  expect(Object.keys(nodeEntry)).toEqual(expect.arrayContaining(['parseText', 'parseFile', 'processFile']))
  const names = [...Object.keys(main), ...Object.keys(nodeEntry)]
  ;['withSource', 'withOrigin', 'sourceKey', 'originKey'].forEach(name => expect(names).not.toContain(name))
})
