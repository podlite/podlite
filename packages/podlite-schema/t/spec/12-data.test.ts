import { toTree, toHtml } from '../..'

it('spec: 12-data 0', () => {
  const pod = `
=begin pod
=begin data :key<Virtues>
Laziness

Impatience
Hubris
=end data
=data Industry
=data Patience
=data Humility

say 'The three virtues are:';
say $=data<Virtues>;
=end pod

`
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 })
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "config": Array [],
        "content": Array [
          Object {
            "config": Array [
              Object {
                "name": "key",
                "type": "string",
                "value": "Virtues",
              },
            ],
            "content": Array [
              Object {
                "type": "verbatim",
                "value": "Laziness

    Impatience
    Hubris
    ",
              },
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 9,
                "offset": 76,
              },
              "start": Object {
                "column": 1,
                "line": 3,
                "offset": 12,
              },
            },
            "margin": "",
            "name": "data",
            "text": "=begin data :key<Virtues>
    Laziness

    Impatience
    Hubris
    =end data
    ",
            "type": "block",
          },
          Object {
            "config": Array [],
            "content": Array [
              Object {
                "type": "verbatim",
                "value": "Industry
    ",
              },
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 10,
                "offset": 91,
              },
              "start": Object {
                "column": 1,
                "line": 9,
                "offset": 76,
              },
            },
            "margin": "",
            "name": "data",
            "type": "block",
          },
          Object {
            "config": Array [],
            "content": Array [
              Object {
                "type": "verbatim",
                "value": "Patience
    ",
              },
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 11,
                "offset": 106,
              },
              "start": Object {
                "column": 1,
                "line": 10,
                "offset": 91,
              },
            },
            "margin": "",
            "name": "data",
            "type": "block",
          },
          Object {
            "config": Array [],
            "content": Array [
              Object {
                "type": "verbatim",
                "value": "Humility
    ",
              },
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 12,
                "offset": 121,
              },
              "start": Object {
                "column": 1,
                "line": 11,
                "offset": 106,
              },
            },
            "margin": "",
            "name": "data",
            "type": "block",
          },
          Object {
            "type": "blankline",
          },
          Object {
            "content": Array [
              "say 'The three virtues are:';
    say $=data<Virtues>;
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 15,
                "offset": 173,
              },
              "start": Object {
                "column": 1,
                "line": 13,
                "offset": 122,
              },
            },
            "margin": "",
            "text": "say 'The three virtues are:';
    say $=data<Virtues>;
    ",
            "type": "para",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 16,
            "offset": 182,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "name": "pod",
        "type": "block",
      },
      Object {
        "type": "blankline",
      },
    ]
  `)
})
