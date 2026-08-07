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
                        "X",
                      ],
                      "name": "cell",
                      "type": "block",
                    },
                    Object {
                      "content": Array [
                        "Y",
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
                        "1",
                      ],
                      "name": "cell",
                      "type": "block",
                    },
                    Object {
                      "content": Array [
                        "2",
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
                        "X",
                      ],
                      "name": "cell",
                      "type": "block",
                    },
                    Object {
                      "content": Array [
                        "Y",
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
                        "1a",
                      ],
                      "name": "cell",
                      "type": "block",
                    },
                    Object {
                      "content": Array [
                        "2a",
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

describe('two whitespace characters separate columns', () => {
  const podlite = require('../../core/src').podlite
  const cellsOf = (src: string): string[] => {
    const p = podlite({ importPlugins: true })
    const html = p.toHtml(p.toAst(p.parse(src))).toString()
    return (html.match(/<t[dh][^>]*>(.*?)<\/t[dh]>/g) || []).map(c => c.replace(/<[^>]*>/g, '').trim())
  }
  const table = (row: string) =>
    `=begin table\n  A               B\n  ===============|===============\n  ${row}\n=end table\n`

  it('splits a row whose cells stand two spaces apart', () => {
    expect(cellsOf(table('Data corpusXXX  tag'))).toEqual(['A', 'B', 'Data corpusXXX', 'tag'])
  })

  it('splits the same row written with a wider gap', () => {
    expect(cellsOf(table('Data corpusXXX     tag'))).toEqual(['A', 'B', 'Data corpusXXX', 'tag'])
  })

  it('splits a row of non-latin cells', () => {
    expect(cellsOf(table('Данные корпуса  метка'))).toEqual(['A', 'B', 'Данные корпуса', 'метка'])
  })

  it('keeps a single space inside a cell', () => {
    expect(cellsOf(table('two words  tag'))).toEqual(['A', 'B', 'two words', 'tag'])
  })

  it('keeps an empty cell carried by an edge pipe', () => {
    const board = '=table\n    X | O |\n   ---+---+---\n      | X | O\n'
    expect(cellsOf(board)).toEqual(['X', 'O', '', '', 'X', 'O'])
  })
})
