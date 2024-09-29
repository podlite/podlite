import { processFile } from '../src/node-utils'
import { PluginConfig, processPlugin } from '../src'
import linksPlugin from '../src/links-plugin'
import { frozenIds, makeInterator } from '@podlite/schema'

const tctx = { testing: true }
const file1 = `
=begin pod 
L<test|file:./dst.pod6>
L</about>
L<doc:NAME OF THE PROGRAM>
L<Text|doc:NAME OF THE PROGRAM>
L<doc:name_of>
=end pod
`
const file2 = `
=begin pod :puburl("/about")
=for TITLE :id<name_of>
NAME OF THE PROGRAM
=for para :id<test>
This is a test para

=end pod
`
it('linksPlugin: linking1', () => {
  const files = [processFile('virtual/src.pod6', file1), processFile('virtual/dst.pod6', file2)]

  const config: PluginConfig = {
    plugin: linksPlugin(),
    includePatterns: '.*',
  }
  const [res, ctx] = processPlugin(config, files, tctx)
  // collect all links
  const links: any[] = []
  makeInterator({
    'L<>': node => {
      const { meta, content } = node
      links.push(node)
    },
  })(res[0].node)
  expect(links).toMatchInlineSnapshot(`
    Array [
      Object {
        "content": Array [
          Object {
            "type": "text",
            "value": "test",
          },
        ],
        "meta": "/about",
        "name": "L",
        "type": "fcode",
      },
      Object {
        "content": Object {
          "type": "text",
          "value": "/about",
        },
        "meta": null,
        "name": "L",
        "type": "fcode",
      },
      Object {
        "content": Object {
          "type": "text",
          "value": "NAME OF THE PROGRAM",
        },
        "meta": "/about",
        "name": "L",
        "type": "fcode",
      },
      Object {
        "content": Array [
          Object {
            "type": "text",
            "value": "Text",
          },
        ],
        "meta": "/about",
        "name": "L",
        "type": "fcode",
      },
      Object {
        "content": Object {
          "type": "text",
          "value": "NAME OF THE PROGRAM",
        },
        "meta": "/about",
        "name": "L",
        "type": "fcode",
      },
    ]
  `)
})

// it('linksPlugin: linking', () => {
//     const file1=
// `[![Build Status](https://travis-ci.com/Raku/rakudoc.svg?branch=master)](https://travis-ci.com/Raku/rakudoc)

// NAME
// ====

// rakudoc - A tool for reading Raku documentation

// `
//     const file = processFile('virtual/src.md', file1)
//     console.log(JSON.stringify(file, null, 2)   )

//     // expect(links).toMatchInlineSnapshot()
//   })
