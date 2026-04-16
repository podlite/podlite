var parse = require('..').parse
describe('no separator in table  ', () => {
  const t1 = `=begin pod
=for table
  X   Y
  1   2
=end pod`
  it('case 1', () => {
    const tree = parse(t1, { podMode: 0 })
    expect(tree).toMatchInlineSnapshot(`
      Array [
        Object {
          "config": Array [],
          "content": Array [
            Object {
              "config": Array [],
              "content": Array [
                Object {
                  "content": Array [
                    Object {
                      "content": Array [
                        "   X",
                      ],
                      "name": "cell",
                      "type": "block",
                    },
                    Object {
                      "content": Array [
                        " Y",
                      ],
                      "name": "cell",
                      "type": "block",
                    },
                  ],
                  "name": "row",
                  "type": "block",
                },
                Object {
                  "content": Array [
                    Object {
                      "content": Array [
                        "   1",
                      ],
                      "name": "cell",
                      "type": "block",
                    },
                    Object {
                      "content": Array [
                        " 2",
                      ],
                      "name": "cell",
                      "type": "block",
                    },
                  ],
                  "name": "row",
                  "type": "block",
                },
              ],
              "location": Object {
                "end": Object {
                  "column": 1,
                  "line": 5,
                  "offset": 38,
                },
                "start": Object {
                  "column": 1,
                  "line": 2,
                  "offset": 11,
                },
              },
              "margin": "",
              "name": "table",
              "type": "block",
            },
          ],
          "location": Object {
            "end": Object {
              "column": 9,
              "line": 5,
              "offset": 46,
            },
            "start": Object {
              "column": 1,
              "line": 1,
              "offset": 0,
            },
          },
          "margin": "",
          "name": "pod",
          "type": "block",
        },
      ]
    `)
  })

  const t2 = `=begin pod
=for table
  X   Y
  1a   2a
=end pod`
  it('case 2', () => {
    const tree = parse(t2, { podMode: 0 })
    expect(tree).toMatchInlineSnapshot(`
      Array [
        Object {
          "config": Array [],
          "content": Array [
            Object {
              "config": Array [],
              "content": Array [
                Object {
                  "content": Array [
                    Object {
                      "content": Array [
                        "   X ",
                      ],
                      "name": "cell",
                      "type": "block",
                    },
                    Object {
                      "content": Array [
                        " Y",
                      ],
                      "name": "cell",
                      "type": "block",
                    },
                  ],
                  "name": "row",
                  "type": "block",
                },
                Object {
                  "content": Array [
                    Object {
                      "content": Array [
                        "   1a",
                      ],
                      "name": "cell",
                      "type": "block",
                    },
                    Object {
                      "content": Array [
                        "  2a",
                      ],
                      "name": "cell",
                      "type": "block",
                    },
                  ],
                  "name": "row",
                  "type": "block",
                },
              ],
              "location": Object {
                "end": Object {
                  "column": 1,
                  "line": 5,
                  "offset": 40,
                },
                "start": Object {
                  "column": 1,
                  "line": 2,
                  "offset": 11,
                },
              },
              "margin": "",
              "name": "table",
              "type": "block",
            },
          ],
          "location": Object {
            "end": Object {
              "column": 9,
              "line": 5,
              "offset": 48,
            },
            "start": Object {
              "column": 1,
              "line": 1,
              "offset": 0,
            },
          },
          "margin": "",
          "name": "pod",
          "type": "block",
        },
      ]
    `)
  })
})
