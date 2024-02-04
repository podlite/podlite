import React from 'react'
import { PodliteDocument, frozenIds, podlitePluggable, validateAstTree } from '@podlite/schema'
import { PluginRegister } from '../src'
import { renderToStaticMarkup } from 'react-dom/server'
import { makeTestPodlite } from '@podlite/to-jsx'

const Podlite = makeTestPodlite(
  podlitePluggable().use({
    ...PluginRegister,
  }),
)

export const parse = (str: string): PodliteDocument => {
  let podlite = podlitePluggable().use({
    ...PluginRegister,
  })
  let tree = podlite.parse(str)
  const asAst = podlite.toAstResult(tree)
  return frozenIds()(asAst.interator)
}

it('=Markdown: check line offset', () => {
  const pod = `
=para test
=Markdown
header1
`
  const tree = parse(pod)
  //   console.log(JSON.stringify(tree, null, 2));
  const r = validateAstTree([tree])
  expect(r).toEqual([])
  expect(parse(pod)).toMatchInlineSnapshot(`
    Object {
      "content": Array [
        Object {
          "type": "blankline",
        },
        Object {
          "content": Array [
            Object {
              "content": Array [
                Object {
                  "type": "text",
                  "value": "test
    ",
                },
              ],
              "location": Object {
                "end": Object {
                  "column": 1,
                  "line": 3,
                  "offset": 12,
                },
                "start": Object {
                  "column": 1,
                  "line": 2,
                  "offset": 1,
                },
              },
              "margin": "",
              "text": "test
    ",
              "type": "para",
            },
          ],
          "id": "id",
          "location": Object {
            "end": Object {
              "column": 1,
              "line": 3,
              "offset": 12,
            },
            "start": Object {
              "column": 1,
              "line": 2,
              "offset": 1,
            },
          },
          "margin": "",
          "name": "para",
          "type": "block",
        },
        Object {
          "config": Array [],
          "content": Object {
            "content": Array [
              Object {
                "content": Array [
                  "header1",
                ],
                "id": "id",
                "location": Object {
                  "end": Object {
                    "column": 8,
                    "line": 4,
                    "offset": 7,
                  },
                  "start": Object {
                    "column": 1,
                    "line": 4,
                    "offset": 0,
                  },
                },
                "margin": "",
                "text": "text",
                "type": "para",
              },
            ],
            "id": "id",
            "margin": "",
            "name": "root",
            "type": "block",
          },
          "id": "id",
          "location": Object {
            "end": Object {
              "column": 1,
              "line": 5,
              "offset": 30,
            },
            "start": Object {
              "column": 1,
              "line": 3,
              "offset": 12,
            },
          },
          "margin": "",
          "name": "Markdown",
          "type": "block",
        },
      ],
      "id": "id",
      "margin": "",
      "name": "root",
      "type": "block",
    }
  `)
})

it('=Markdown: jsx', () => {
  const pod = `
  =para test
      =begin Markdown
      header1
      =head1 **ss**
      ddd
      =end Markdown
    `
  //   render(<Podlite>{pod}</Podlite>);
  expect(renderToStaticMarkup(<Podlite>{pod}</Podlite>)).toMatchInlineSnapshot(`
    <div id="id">
      <p>
        test
      </p>
    </div>
    <p id="id">
      header1
    =head1
      <strong>
        ss
      </strong>
      ddd
    </p>
    <p>
    </p>
  `)
})

it("=Markdown: check 'delete' line element", () => {
  const pod = `
=begin Markdown
asd ~~asdsd~~
=end Markdown
  `
  //   render(<Podlite>{pod}</Podlite>);
  expect(renderToStaticMarkup(<Podlite>{pod}</Podlite>)).toMatchInlineSnapshot(`
    <p id="id">
      asd
      <del>
        asdsd
      </del>
    </p>
    <p>
    </p>
  `)
})

it('=Markdown: table render', () => {
  const pod = `
  =begin Markdown
  | Syntax      | Description |
  | ----------- | ----------- |
  | Header      | Title       |
  | Paragraph   | Text        |
  =end Markdown
    `

  //   render(<Podlite>{pod}</Podlite>);
  //   console.log(root.innerHTML);
  expect(renderToStaticMarkup(<Podlite>{pod}</Podlite>)).toMatchInlineSnapshot(`
    <table id="id">
      <caption class="caption">
      </caption>
      <tbody>
        <tr id="id">
          <td id="id">
            Syntax
          </td>
          <td id="id">
            Description
          </td>
        </tr>
        <tr id="id">
          <td id="id">
            Header
          </td>
          <td id="id">
            Title
          </td>
        </tr>
        <tr id="id">
          <td id="id">
            Paragraph
          </td>
          <td id="id">
            Text
          </td>
        </tr>
      </tbody>
    </table>
    <p>
    </p>
  `)
})
