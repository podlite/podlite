import { processFile } from '../src/node-utils'
import { PluginConfig, processPlugin } from '../src'
import linksPlugin from '../src/links-plugin'
import { frozenIds, makeInterator, PodNode, toHtml, toMarkdown } from '@podlite/schema'

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

describe('the text a doc: link takes from the document it names', () => {
  const linked = (name: string, body = 'L<doc:aurora>') => {
    const src = `=begin pod\n${body}\n=end pod\n`
    const dst = `=begin pod :puburl("/secret")\n=for NAME :id<aurora>\n${name}\n=end pod\n`
    const files = [processFile('virtual/src.podlite', src), processFile('virtual/dst.podlite', dst)]
    const [res] = processPlugin({ plugin: linksPlugin(), includePatterns: '.*' }, files, tctx)
    const links: PodNode[] = []
    makeInterator({ 'L<>': node => void links.push(node) })(res[0].node)
    const tree = res[0].node
    return {
      link: links[0] as { meta: string; content: any },
      html: String(toHtml({}).run(tree)),
      md: String(toMarkdown({}).run(tree)),
    }
  }

  it('marks the hidden word and the page shows it masked', () => {
    const { link, html, md } = linked('Project G<Aurora>')
    expect(link.meta).toBe('/secret')
    expect(link.content).toEqual([
      { type: 'text', value: 'Project ' },
      { type: 'text', value: 'Aurora', guarded: true },
    ])
    expect(html).toContain('Project ██████')
    expect(html).not.toContain('Aurora')
    expect(md).not.toContain('Aurora')
  })

  it('keeps one plain text node when nothing is hidden', () => {
    expect(linked('Project Aurora').link.content).toEqual({ type: 'text', value: 'Project Aurora' })
  })

  it('marks a hidden word held in a single code', () => {
    const { link, html } = linked('Project G<S<secret>>')
    expect(link.content[1]).toEqual({ type: 'text', value: 'secret', guarded: true })
    expect(html).toContain('>Project ██████</a>')
  })

  it('cuts the name at both ends and keeps the inner spaces', () => {
    const { link, html, md } = linked('G<Hidden> middle G<end>')
    expect(link.content.map((leaf: { value: string }) => leaf.value).join('')).toBe('Hidden middle end')
    expect(link.content[link.content.length - 1]).toEqual({ type: 'text', value: 'end', guarded: true })
    expect(html).toContain('██████ middle ███')
    expect(md).toContain('██████ middle ███')
  })

  it('leaves a backlink to a hidden section as written', () => {
    const body = 'W<related discussion|file:./internal.podlite#sec-secret>'
    const before = processFile('virtual/w.podlite', `=begin pod\n${body}\n=end pod\n`)
    const [res] = processPlugin({ plugin: linksPlugin(), includePatterns: '.*' }, [before], tctx)
    const backlinks: PodNode[] = []
    makeInterator({ 'W<>': node => void backlinks.push(node) })(res[0].node)
    expect(backlinks).toHaveLength(1)
    expect(String(toHtml({}).run(res[0].node))).toContain('related discussion')
  })
})

// whitespace on either side of the bar is not significant (Specification 3930)
it('linksPlugin: an address with spaces around it finds its document', () => {
  const src = `
=begin pod
L<Text| doc:name_of >
L<doc:name_of >
L<doc:name_of| >
L<doc:name_of|>
=end pod
`
  const files = [processFile('virtual/src.pod6', src), processFile('virtual/dst.pod6', file2)]
  const [res] = processPlugin({ plugin: linksPlugin(), includePatterns: '.*' }, files, tctx)
  const metas: any[] = []
  makeInterator({ 'L<>': node => void metas.push(node.meta) })(res[0].node)
  expect(metas.slice(0, 2)).toEqual(['/about', '/about'])
  expect(metas[2]).toEqual(metas[3])
})
