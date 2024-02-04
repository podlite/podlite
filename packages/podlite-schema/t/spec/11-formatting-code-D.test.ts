import { toTree, toHtml } from '../..'

it('spec: 11-formatting-code-D 0', () => {
  const pod = `
=para
  A D<formatting code|formatting codes;formatters> provides a way
    to add inline mark-up to a D<piece> of text.

`
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 })
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "content": Array [
          Object {
            "content": Array [
              "  A ",
              Object {
                "content": Array [
                  "formatting code",
                ],
                "name": "D",
                "synonyms": Array [
                  "formatting codes",
                  "formatters",
                ],
                "type": "fcode",
              },
              " provides a way
        to add inline mark-up to a ",
              Object {
                "content": Array [
                  "piece",
                ],
                "name": "D",
                "synonyms": null,
                "type": "fcode",
              },
              " of text.
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 5,
                "offset": 122,
              },
              "start": Object {
                "column": 1,
                "line": 2,
                "offset": 1,
              },
            },
            "margin": "",
            "text": "  A D<formatting code|formatting codes;formatters> provides a way
        to add inline mark-up to a D<piece> of text.
    ",
            "type": "para",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 5,
            "offset": 122,
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
        "type": "blankline",
      },
    ]
  `)
})
