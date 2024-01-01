import { toTree, toHtml } from "../..";

it("spec: 04a-input-output 0", () => {
  const pod = `
=begin pod
    =begin output
        Name:    Baracus, B.A.
        Age:     49
        Print? B<K<n>>
    =end output
    =begin output
        Name:    Baracus, B.A.
        Age:     49
        Print? B<K<n>>
    =end output
=end pod

`;
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 });
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "config": Array [],
        "content": Array [
          Object {
            "config": Array [],
            "content": Array [
              "    Name:    Baracus, B.A.
        Age:     49
        Print? ",
              Object {
                "content": Array [
                  Object {
                    "content": Array [
                      "n",
                    ],
                    "name": "K",
                    "type": "fcode",
                  },
                ],
                "name": "B",
                "type": "fcode",
              },
              "
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 8,
                "offset": 120,
              },
              "start": Object {
                "column": 1,
                "line": 3,
                "offset": 12,
              },
            },
            "margin": "    ",
            "name": "output",
            "text": "    =begin output
            Name:    Baracus, B.A.
            Age:     49
            Print? B<K<n>>
        =end output
    ",
            "type": "block",
          },
          Object {
            "config": Array [],
            "content": Array [
              "    Name:    Baracus, B.A.
        Age:     49
        Print? ",
              Object {
                "content": Array [
                  Object {
                    "content": Array [
                      "n",
                    ],
                    "name": "K",
                    "type": "fcode",
                  },
                ],
                "name": "B",
                "type": "fcode",
              },
              "
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 13,
                "offset": 228,
              },
              "start": Object {
                "column": 1,
                "line": 8,
                "offset": 120,
              },
            },
            "margin": "    ",
            "name": "output",
            "text": "    =begin output
            Name:    Baracus, B.A.
            Age:     49
            Print? B<K<n>>
        =end output
    ",
            "type": "block",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 14,
            "offset": 237,
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
  `);
});
