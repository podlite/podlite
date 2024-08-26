import { processFile } from '../src/node-utils'
import { composePlugins, PluginConfig, processPlugin } from '../src'

import siteDataPlugin from '../src/site-data-plugin'
import pubdatePlugin from '../src/pubdate-plugin'
import imagesPlugin from '../src/images-plugin'
import linksPlugin from '../src/links-plugin'
import reactPlugin from '../src/react-plugin'
import stateVersionPlugin from '../src/state-version-plugin'
const tctx = { testing: true }
const makeConfigMainPlugin = () => {
  const configSiteDataPlugin: PluginConfig = {
    plugin: siteDataPlugin({
      public_path: '/tmp/public',
      indexFilePath: 'virtual/index.podlite',
      built_path: '/built',
      site_url: 'http://example.com',
    }),
    includePatterns: '.*',
  }
  const configPubdatePlugin: PluginConfig = {
    plugin: pubdatePlugin(),
    includePatterns: '.*',
  }
  const configImagesPlugin: PluginConfig = {
    plugin: imagesPlugin(),
    includePatterns: '.*',
  }
  const configLinksPlugin: PluginConfig = {
    plugin: linksPlugin(),
    includePatterns: '.*',
  }
  const configReactPlugin: PluginConfig = {
    plugin: reactPlugin(),
    includePatterns: '.*',
  }

  const configStateVersionPlugin: PluginConfig = {
    plugin: stateVersionPlugin(),
    includePatterns: '.*',
  }
  return composePlugins(
    [
      configPubdatePlugin,
      configImagesPlugin,
      configLinksPlugin,
      configReactPlugin,
      configStateVersionPlugin,
      configSiteDataPlugin,
    ],
    tctx,
  )
}
const makeAbstactDocument = (title: string, content: string) => {
  return `
=begin pod 
=TITLE ${title}
=para
${content}
=end pod
`
}
const file1 = processFile(
  'virtual/t1.podlite',
  `
=begin pod :pubdate('2024-06-01') 
=for TITLE :id<about>
About

=end pod
    `,
)
const file2 = processFile(
  'virtual/t2.podlite',
  `
        =begin pod :pubdate('2024-06-01') 
        =for TITLE 
        Test
        
        L<doc:About>
        =end pod
            `,
)
const indexFile = `
=begin pod :pubdate('2024-06-01')
= :favicon<./logo.png>
= :puburl<http://example.com>
= :globalStyles("./styles.css")

=TITLE Site Index

index content
=end pod
`

it('main publish logic: process files', () => {
  const state = [processFile('virtual/index.podlite', indexFile), file2, file1]
  const [resState, resCtx] = processPlugin(makeConfigMainPlugin(), state, tctx)
  delete resCtx.siteData.node
  delete resCtx.stateVersion
  expect(resCtx).toMatchInlineSnapshot(`
    Object {
      "componensMap": Object {},
      "imagesMap": Object {},
      "nextPublishTime": undefined,
      "siteData": Object {
        "favicon": "favicon.png",
        "footer": "",
        "globalStyles": "./styles.css",
        "gtmId": undefined,
        "postsPerPage": undefined,
        "redirects": Array [
          Object {
            "destination": "/2024/6/1/1/test",
            "source": "/a5XF1",
            "statusCode": 308,
          },
          Object {
            "destination": "/2024/6/1/2/about",
            "source": "/a5XF2",
            "statusCode": 308,
          },
        ],
        "title": "Site Index
    ",
        "url": "http://example.com",
      },
      "testing": true,
    }
  `)
})
