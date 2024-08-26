import { processFile } from '../src/node-utils'
import { PluginConfig, processPlugin } from '../src'
import imagesPlugin from '../src/images-plugin'

const tctx = { testing: true }
const file1 = `
=begin pod 
=Image open_and_browsing.mp4
=picture open_and_browsing.png
=end pod
`

it('imagesPlugin: extract images', () => {
  const t1 = processFile('t/image-plugin/virtualFile.podlite', file1)
  const config: PluginConfig = {
    plugin: imagesPlugin(),
    includePatterns: '.*',
  }
  const [res, ctx] = processPlugin(config, [t1], tctx)
  expect(ctx).toMatchInlineSnapshot(`
    Object {
      "imagesMap": Object {
        "t/image-plugin/open_and_browsing.mp4": "iimage_plugin_open_and_browsing_mp4",
        "t/image-plugin/open_and_browsing.png": "iimage_plugin_open_and_browsing_png",
      },
      "testing": true,
    }
  `)
})
