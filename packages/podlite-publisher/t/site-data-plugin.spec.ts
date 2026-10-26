import { processFile } from '../src/node-utils'
import { PluginConfig, processPlugin } from '../src'
import siteDataPlugin, { buildStylesContent } from '../src/site-data-plugin'
import imagesPlugin from '../src/images-plugin'
import * as fs from 'fs'
import * as os from 'os'
import pathMod from 'path'

const makeAbstactDocument = (title: string, content: string) => {
  return `
=begin pod 
=TITLE ${title}
=para
${content}
=end pod
`
}
const indexFile = `
=begin pod 
= :favicon<./logo.png>
= :puburl<http://example.com>
= :globalStyles("./styles.css")

=TITLE Site Index
=end pod
`
const tctx = { testing: true }
it('linksPlugin: linking', () => {
  const state = [processFile('virtual/index.podlite', indexFile)]

  const getVersion = state => {
    const config: PluginConfig = {
      plugin: siteDataPlugin({
        public_path: '/tmp/public',
        indexFilePath: 'virtual/index.podlite',
        built_path: '/built',
        site_url: 'http://example.com',
      }),
      includePatterns: '.*',
    }
    const [res, context] = processPlugin(config, state, tctx)
    return context
  }
  const { siteData } = getVersion(state)
  const { node, item, ...rest } = siteData
  expect(rest).toMatchInlineSnapshot(`
    Object {
      "favicon": "favicon.png",
      "footer": "",
      "globalStyles": "./styles.css",
      "gtmId": undefined,
      "postsPerPage": undefined,
      "redirects": Array [],
      "title": "Site Index
    ",
      "url": "http://example.com",
    }
  `)
})

it('siteDataPlugin: :theme attribute propagates to siteData', () => {
  const themedIndex = `
=begin pod
= :favicon<./logo.png>
= :puburl<http://example.com>
= :theme<product>

=TITLE Themed Site
=end pod
`
  const state = [processFile('virtual/index.podlite', themedIndex)]
  const config: PluginConfig = {
    plugin: siteDataPlugin({
      public_path: '/tmp/public',
      indexFilePath: 'virtual/index.podlite',
      built_path: '/built',
      site_url: 'http://example.com',
    }),
    includePatterns: '.*',
  }
  const [, context] = processPlugin(config, state, tctx)
  expect(context.siteData.theme).toBe('product')
})

it('siteDataPlugin: :language attribute propagates to siteData', () => {
  const localisedIndex = `
=begin pod
= :favicon<./logo.png>
= :puburl<http://example.com>
= :language<ru>

=TITLE Localised Site
=end pod
`
  const state = [processFile('virtual/index.podlite', localisedIndex)]
  const config: PluginConfig = {
    plugin: siteDataPlugin({
      public_path: '/tmp/public',
      indexFilePath: 'virtual/index.podlite',
      built_path: '/built',
      site_url: 'http://example.com',
    }),
    includePatterns: '.*',
  }
  const [, context] = processPlugin(config, state, tctx)
  expect(context.siteData.language).toBe('ru')
})

it('siteDataPlugin: no :language attribute leaves the field out', () => {
  const state = [processFile('virtual/index.podlite', indexFile)]
  const config: PluginConfig = {
    plugin: siteDataPlugin({
      public_path: '/tmp/public',
      indexFilePath: 'virtual/index.podlite',
      built_path: '/built',
      site_url: 'http://example.com',
    }),
    includePatterns: '.*',
  }
  const [, context] = processPlugin(config, state, tctx)
  expect('language' in context.siteData).toBe(false)
})

it('buildStylesContent: theme only — emits theme @import', () => {
  expect(buildStylesContent('product', undefined)).toMatch(/@import '@Styles\/themes\/product\.css';/)
})

it('buildStylesContent: globalStyles only — emits resolved path, no default', () => {
  const result = buildStylesContent(undefined, '../site/page.styles.css')
  expect(result).toMatch(/@import '\.\.\/site\/page\.styles\.css';/)
  expect(result).not.toMatch(/@Styles\/default/)
})

it('buildStylesContent: theme + globalStyles — theme first then globalStyles', () => {
  const result = buildStylesContent('portrait-avatar', '../site/page.styles.css')
  const themePos = result.indexOf('@Styles/themes/portrait-avatar.css')
  const sitePos = result.indexOf('../site/page.styles.css')
  expect(themePos).toBeGreaterThan(-1)
  expect(sitePos).toBeGreaterThan(-1)
  expect(themePos).toBeLessThan(sitePos)
})

it('buildStylesContent: neither theme nor globalStyles — fallback to default', () => {
  expect(buildStylesContent(undefined, undefined)).toMatch(/@import '@Styles\/default';/)
})

it('siteDataPlugin: a hidden word in the site title is masked', () => {
  const index =
    '=begin pod\n= :favicon<./logo.png>\n= :puburl<http://example.com>\n\n=TITLE Site G<Internal>\n=end pod\n'
  const state = [processFile('virtual/index.podlite', index)]
  const config: PluginConfig = {
    plugin: siteDataPlugin({
      public_path: '/tmp/public',
      indexFilePath: 'virtual/index.podlite',
      built_path: '/built',
      site_url: 'http://example.com',
    }),
    includePatterns: '.*',
  }
  const [, context] = processPlugin(config, state, tctx)
  expect(context.siteData.title.trim()).toBe('Site ████████')
})

it('the site data carries the map of images the images plugin found', () => {
  const imagesDoc = processFile(
    't/image-plugin/virtualFile.podlite',
    `
=begin pod
=picture open_and_browsing.png
=end pod
`,
  )
  const [, imagesCtx] = processPlugin({ plugin: imagesPlugin(), includePatterns: '.*' }, [imagesDoc], tctx)
  // a real build writes its files, so this one runs outside the testing mode, in a scratch directory
  const dir = fs.mkdtempSync(pathMod.join(os.tmpdir(), 'site-data-'))
  fs.writeFileSync(pathMod.join(dir, 'logo.png'), '')
  const indexFilePath = pathMod.join(dir, 'index.podlite')
  const config: PluginConfig = {
    plugin: siteDataPlugin({ public_path: dir, indexFilePath, built_path: dir, site_url: 'http://example.com' }),
    includePatterns: '.*',
  }
  processPlugin(config, [processFile(indexFilePath, indexFile)], { ...imagesCtx, testing: false })
  const data = JSON.parse(fs.readFileSync(pathMod.join(dir, 'data.json'), 'utf8'))
  expect(data.imagesMap).toEqual({ 't/image-plugin/open_and_browsing.png': 'iimage_plugin_open_and_browsing_png' })
  expect(data.imagesMap).toEqual(JSON.parse(fs.readFileSync(pathMod.join(dir, 'imagesMap.json'), 'utf8')))
  fs.rmSync(dir, { recursive: true, force: true })
})
