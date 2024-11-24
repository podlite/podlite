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

it('=markdown: check line offset', () => {
  const pod = `
=para test
=markdown
header1
`
  const tree = parse(pod)
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
          "name": "markdown",
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

it('=markdown: jsx', () => {
  const pod = `
  =para test
      =begin markdown
      header1
      =head1 **ss**
      ddd
      =end markdown
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

it("=markdown: check 'delete' line element", () => {
  const pod = `
=begin markdown
asd ~~asdsd~~
=end markdown
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

it('=markdown: table render', () => {
  const pod = `
  =begin markdown
  | Syntax      | Description |
  | ----------- | ----------- |
  | Header      | Title       |
  | Paragraph   | Text        |
  =end markdown
    `
  //   render(<Podlite>{pod}</Podlite>);
  //   console.log(root.innerHTML);
  expect(renderToStaticMarkup(<Podlite>{pod}</Podlite>)).toMatchInlineSnapshot(`
    <table id="id">
      <caption class="caption">
      </caption>
      <tbody>
        <tr>
          <th>
            Syntax
          </th>
          <th>
            Description
          </th>
        </tr>
        <tr>
          <td>
            Header
          </td>
          <td>
            Title
          </td>
        </tr>
        <tr>
          <td>
            Paragraph
          </td>
          <td>
            Text
          </td>
        </tr>
      </tbody>
    </table>
    <p>
    </p>
  `)
})
