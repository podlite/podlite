import { processFile } from '../src/node-utils'
import { PluginConfig, processPlugin } from '../src'
import siteDataPlugin from '../src/site-data-plugin'

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
