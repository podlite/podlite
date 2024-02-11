import { toTree, toHtml } from '../../src'

it('spec: 11-formatting-code-L 0', () => {
  const pod = `
=item L<https://www.python.org/dev/peps/pep-0001/#what-is-a-pep>

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
              Object {
                "content": Array [
                  Object {
                    "content": Array [
                      "https://www.python.org/dev/peps/pep-0001/#what-is-a-pep",
                    ],
                    "meta": null,
                    "name": "L",
                    "type": "fcode",
                  },
                  "
    ",
                ],
                "location": Object {
                  "end": Object {
                    "column": 1,
                    "line": 3,
                    "offset": 66,
                  },
                  "start": Object {
                    "column": 1,
                    "line": 2,
                    "offset": 1,
                  },
                },
                "margin": "",
                "text": "L<https://www.python.org/dev/peps/pep-0001/#what-is-a-pep>
    ",
                "type": "para",
              },
            ],
            "level": 1,
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 3,
                "offset": 66,
              },
              "start": Object {
                "column": 1,
                "line": 2,
                "offset": 1,
              },
            },
            "margin": "",
            "name": "item",
            "type": "block",
          },
          Object {
            "type": "blankline",
          },
        ],
        "level": 1,
        "list": "itemized",
        "type": "list",
      },
    ]
  `)
})
it('spec: 11-formatting-code-L 1', () => {
  const pod = `L«tex C<tsdsd>|https://www.text»`
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 })
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "content": Array [
          Object {
            "content": Array [
              "tex ",
              Object {
                "content": Array [
                  "tsdsd",
                ],
                "name": "C",
                "type": "fcode",
              },
            ],
            "meta": "https://www.text",
            "name": "L",
            "type": "fcode",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 33,
            "line": 1,
            "offset": 32,
          },
          "start": Object {
            "column": 1,
            "line": 1,
            "offset": 0,
          },
        },
        "margin": "",
        "text": "L«tex C<tsdsd>|https://www.text»",
        "type": "para",
      },
    ]
  `)
})
