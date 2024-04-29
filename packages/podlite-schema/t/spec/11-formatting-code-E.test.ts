import { toTree, toHtml } from '../..'
import { validateAst } from '../..'

it('spec: 11-formatting-code-E 0', () => {
  const pod = `
=para  E<171> xcxc E<0d171; 0o253; 0b10101011; 0xAB>

`
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 })
  expect(validateAst(tree)).toEqual([])
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
                    "type": "number",
                    "value": 171,
                  },
                ],
                "name": "E",
                "type": "fcode",
              },
              " xcxc ",
              Object {
                "content": Array [
                  Object {
                    "type": "number",
                    "value": 171,
                  },
                  Object {
                    "type": "number",
                    "value": 171,
                  },
                  Object {
                    "type": "number",
                    "value": 171,
                  },
                  Object {
                    "type": "number",
                    "value": 171,
                  },
                ],
                "name": "E",
                "type": "fcode",
              },
              "
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 3,
                "offset": 54,
              },
              "start": Object {
                "column": 1,
                "line": 2,
                "offset": 1,
              },
            },
            "margin": "",
            "text": "E<171> xcxc E<0d171; 0o253; 0b10101011; 0xAB>
    ",
            "type": "para",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 3,
            "offset": 54,
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

it('spec: 11-formatting-code-E 1', () => {
  const pod = `
  =para  E<bull> E<amp; quot; ndash> E<LEFT DOUBLE ANGLE BRACKET> E<171;ndash>
  `
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 })
  expect(validateAst(tree)).toEqual([])

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
                    "type": "html_named",
                    "value": "bull",
                  },
                ],
                "name": "E",
                "type": "fcode",
              },
              " ",
              Object {
                "content": Array [
                  Object {
                    "type": "html_named",
                    "value": "amp",
                  },
                  Object {
                    "type": "html_named",
                    "value": "quot",
                  },
                  Object {
                    "type": "html_named",
                    "value": "ndash",
                  },
                ],
                "name": "E",
                "type": "fcode",
              },
              " ",
              Object {
                "content": Array [
                  Object {
                    "type": "unicode_name",
                    "value": "LEFT DOUBLE ANGLE BRACKET",
                  },
                ],
                "name": "E",
                "type": "fcode",
              },
              " ",
              Object {
                "content": Array [
                  Object {
                    "type": "number",
                    "value": 171,
                  },
                  Object {
                    "type": "html_named",
                    "value": "ndash",
                  },
                ],
                "name": "E",
                "type": "fcode",
              },
              "
      ",
            ],
            "location": Object {
              "end": Object {
                "column": 3,
                "line": 3,
                "offset": 82,
              },
              "start": Object {
                "column": 1,
                "line": 2,
                "offset": 1,
              },
            },
            "margin": "",
            "text": "E<bull> E<amp; quot; ndash> E<LEFT DOUBLE ANGLE BRACKET> E<171;ndash>
      ",
            "type": "para",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 3,
            "line": 3,
            "offset": 82,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "  ",
        "name": "para",
        "type": "block",
      },
    ]
  `)
})
