import { processFile } from '../src/node-utils'
import { PluginConfig, processPlugin } from '../src'
import breadcrumbPlugin from '../src/breadcrumb-plugin'

const tctx = { testing: true }
const file1 = `
=begin pod :puburl</doc>

=TITLE Documentation

=end pod
`
const file2 = `
=begin pod :puburl</doc/m>

=TITLE Modules

=end pod
`

const file3 = `
=begin pod :puburl</doc/m/foo>

=TITLE Foo

=end pod
`

it('breadcrumb: process Files', () => {
  const state = [
    processFile('t/image-plugin/virtualFile.podlite', file1),
    processFile('t/image-plugin/virtualFile.podlite', file2),
    processFile('t/image-plugin/virtualFile.podlite', file3),
  ]
  const config: PluginConfig = {
    plugin: breadcrumbPlugin(),
    includePatterns: '.*',
  }

  const [res, ctx] = processPlugin(config, state, tctx)
  expect(state.map(i => i.pluginsData)).toMatchInlineSnapshot(`
    Array [
      Object {
        "breadcrumb": Array [
          Object {
            "publishUrl": "/doc",
            "title": "Documentation
    ",
          },
        ],
      },
      Object {
        "breadcrumb": Array [
          Object {
            "publishUrl": "/doc",
            "title": "Documentation
    ",
          },
          Object {
            "publishUrl": "/doc/m",
            "title": "Modules
    ",
          },
        ],
      },
      Object {
        "breadcrumb": Array [
          Object {
            "publishUrl": "/doc",
            "title": "Documentation
    ",
          },
          Object {
            "publishUrl": "/doc/m",
            "title": "Modules
    ",
          },
          Object {
            "publishUrl": "/doc/m/foo",
            "title": "Foo
    ",
          },
        ],
      },
    ]
  `)
})

it('breadcrumb: missed Files in path', () => {
  const state = [
    processFile('t/image-plugin/virtualFile.podlite', file1),
    processFile('t/image-plugin/virtualFile.podlite', file3),
  ]
  const config: PluginConfig = {
    plugin: breadcrumbPlugin(),
    includePatterns: '.*',
  }

  const [res, ctx] = processPlugin(config, state, tctx)
  expect(state[1].pluginsData).toMatchInlineSnapshot(`
    Object {
      "breadcrumb": Array [
        Object {
          "publishUrl": "/doc",
          "title": "Documentation
    ",
        },
        Object {
          "publishUrl": "/doc/m/foo",
          "title": "Foo
    ",
        },
      ],
    }
  `)
})
