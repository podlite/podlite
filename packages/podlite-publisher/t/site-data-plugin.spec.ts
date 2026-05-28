import { processFile } from '../src/node-utils'
import { PluginConfig, processPlugin } from '../src'
import siteDataPlugin, { buildStylesContent } from '../src/site-data-plugin'

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
