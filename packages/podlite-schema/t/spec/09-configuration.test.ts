import { toTree, toHtml } from "../..";

it("spec: 09-configuration 0", () => {
  const pod = `
=begin pod
    =begin code :allow<B>
    =end code
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
            "config": Array [
              Object {
                "name": "allow",
                "type": "array",
                "value": Array [
                  "B",
                ],
              },
            ],
            "content": Array [],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 5,
                "offset": 52,
              },
              "start": Object {
                "column": 1,
                "line": 3,
                "offset": 12,
              },
            },
            "margin": "    ",
            "name": "code",
            "type": "block",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 6,
            "offset": 61,
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

it("spec: 09-configuration 1", () => {
  const pod = `
=begin pod
    =config head2  :like<head1> :formatted<I>
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
            "config": Array [
              Object {
                "name": "like",
                "type": "string",
                "value": "head1",
              },
              Object {
                "name": "formatted",
                "type": "string",
                "value": "I",
              },
            ],
            "margin": "    ",
            "name": "head2",
            "type": "config",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 5,
            "offset": 67,
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

it("spec: 09-configuration 2", () => {
  const pod = `
=begin pod
    =for pod :number(42) :zebras :!sheep :feist<1 2 3 4>
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
            "config": Array [
              Object {
                "name": "number",
                "type": "value",
                "value": 42,
              },
              Object {
                "name": "zebras",
                "type": "boolean",
                "value": true,
              },
              Object {
                "name": "sheep",
                "type": "boolean",
                "value": false,
              },
              Object {
                "name": "feist",
                "type": "array",
                "value": Array [
                  1,
                  2,
                  3,
                  4,
                ],
              },
            ],
            "content": Array [],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 4,
                "offset": 69,
              },
              "start": Object {
                "column": 1,
                "line": 3,
                "offset": 12,
              },
            },
            "margin": "    ",
            "name": "pod",
            "type": "block",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 5,
            "offset": 78,
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

it("spec: 09-configuration 3", () => {
  const pod = `
=begin pod
=for DESCRIPTION :title<presentation template>
=                :author<John Brown> :pubdate(2011)
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
            "config": Array [
              Object {
                "name": "title",
                "type": "string",
                "value": "presentation template",
              },
              Object {
                "name": "author",
                "type": "string",
                "value": "John Brown",
              },
              Object {
                "name": "pubdate",
                "type": "value",
                "value": 2011,
              },
            ],
            "content": Array [],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 5,
                "offset": 111,
              },
              "start": Object {
                "column": 1,
                "line": 3,
                "offset": 12,
              },
            },
            "margin": "",
            "name": "DESCRIPTION",
            "type": "block",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 6,
            "offset": 120,
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

it("spec: 09-configuration 4", () => {
  const pod = `
=begin pod
=for table :caption<Table of contents>
    foo bar
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
            "config": Array [
              Object {
                "name": "caption",
                "type": "string",
                "value": "Table of contents",
              },
            ],
            "content": Array [
              Object {
                "content": Array [
                  Object {
                    "content": Array [
                      " foo bar",
                    ],
                    "name": "table_cell",
                    "type": "block",
                  },
                ],
                "name": "table_row",
                "type": "block",
              },
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 5,
                "offset": 63,
              },
              "start": Object {
                "column": 1,
                "line": 3,
                "offset": 12,
              },
            },
            "margin": "",
            "name": "table",
            "type": "block",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 6,
            "offset": 72,
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

it("spec: 09-configuration 5", () => {
  const pod = `
=begin pod
    =begin code :allow<B>
    These words have some B<importance>.
    =end code
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
            "config": Array [
              Object {
                "name": "allow",
                "type": "array",
                "value": Array [
                  "B",
                ],
              },
            ],
            "content": Array [
              "These words have some ",
              Object {
                "content": Array [
                  "importance",
                ],
                "name": "B",
                "type": "fcode",
              },
              ".
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 6,
                "offset": 93,
              },
              "start": Object {
                "column": 1,
                "line": 3,
                "offset": 12,
              },
            },
            "margin": "    ",
            "name": "code",
            "text": "    =begin code :allow<B>
        These words have some B<importance>.
        =end code
    ",
            "type": "block",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 7,
            "offset": 102,
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

it("spec: 09-configuration 6", () => {
  const pod = `
=begin table :k1<str> :k2('str') :k3("str") :k4["str"] :k5(Q[str])
foo
=end table

`;
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 });
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "config": Array [
          Object {
            "name": "k1",
            "type": "string",
            "value": "str",
          },
          Object {
            "name": "k2",
            "type": "value",
            "value": "str",
          },
          Object {
            "name": "k3",
            "type": "value",
            "value": "str",
          },
          Object {
            "name": "k4",
            "type": "array",
            "value": Array [
              "str",
            ],
          },
          Object {
            "name": "k5",
            "type": "value",
            "value": "Q[str]",
          },
        ],
        "content": Array [
          Object {
            "content": Array [
              Object {
                "content": Array [
                  " foo",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_row",
            "type": "block",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 5,
            "offset": 83,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "name": "table",
        "text": "=begin table :k1<str> :k2('str') :k3(\\"str\\") :k4[\\"str\\"] :k5(Q[str])
    foo
    =end table
    ",
        "type": "block",
      },
      Object {
        "type": "blankline",
      },
    ]
  `);
});

it("spec: 09-configuration 7", () => {
  const pod = `
=begin table :k1<1> :k2(2) :k3[2] :k4[+2000000000] :k5[-2000000000] :k6[+99999999999999999] :k7[-99999999999999999]
foo
=end table

`;
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 });
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "config": Array [
          Object {
            "name": "k1",
            "type": "array",
            "value": Array [
              1,
            ],
          },
          Object {
            "name": "k2",
            "type": "value",
            "value": 2,
          },
          Object {
            "name": "k3",
            "type": "array",
            "value": Array [
              2,
            ],
          },
          Object {
            "name": "k4",
            "type": "array",
            "value": Array [
              2000000000,
            ],
          },
          Object {
            "name": "k5",
            "type": "array",
            "value": Array [
              -2000000000,
            ],
          },
          Object {
            "name": "k6",
            "type": "array",
            "value": Array [
              100000000000000000,
            ],
          },
          Object {
            "name": "k7",
            "type": "array",
            "value": Array [
              -100000000000000000,
            ],
          },
        ],
        "content": Array [
          Object {
            "content": Array [
              Object {
                "content": Array [
                  " foo",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_row",
            "type": "block",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 5,
            "offset": 132,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "name": "table",
        "text": "=begin table :k1<1> :k2(2) :k3[2] :k4[+2000000000] :k5[-2000000000] :k6[+99999999999999999] :k7[-99999999999999999]
    foo
    =end table
    ",
        "type": "block",
      },
      Object {
        "type": "blankline",
      },
    ]
  `);
});

it("spec: 09-configuration 8", () => {
  const pod = `
=begin table :k1(2.3) :k2[-2.3] :k3[+1e4] :k4(3.1e+04) :k5[-3.1E-04]
foo
=end table

`;
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 });
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "config": Array [
          Object {
            "name": "k1",
            "type": "value",
            "value": 2.3,
          },
          Object {
            "name": "k2",
            "type": "array",
            "value": Array [
              -2.3,
            ],
          },
          Object {
            "name": "k3",
            "type": "array",
            "value": Array [
              10000,
            ],
          },
          Object {
            "name": "k4",
            "type": "value",
            "value": 31000,
          },
          Object {
            "name": "k5",
            "type": "array",
            "value": Array [
              -0.00031,
            ],
          },
        ],
        "content": Array [
          Object {
            "content": Array [
              Object {
                "content": Array [
                  " foo",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_row",
            "type": "block",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 5,
            "offset": 85,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "name": "table",
        "text": "=begin table :k1(2.3) :k2[-2.3] :k3[+1e4] :k4(3.1e+04) :k5[-3.1E-04]
    foo
    =end table
    ",
        "type": "block",
      },
      Object {
        "type": "blankline",
      },
    ]
  `);
});

it("spec: 09-configuration 9", () => {
  const pod = `
=begin table :k1 :!k2 :k3(True) :k4[True] :k5(False) :k6[False]
foo
=end table

`;
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 });
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "config": Array [
          Object {
            "name": "k1",
            "type": "boolean",
            "value": true,
          },
          Object {
            "name": "k2",
            "type": "boolean",
            "value": false,
          },
          Object {
            "name": "k3",
            "type": "value",
            "value": true,
          },
          Object {
            "name": "k4",
            "type": "array",
            "value": Array [
              true,
            ],
          },
          Object {
            "name": "k5",
            "type": "value",
            "value": false,
          },
          Object {
            "name": "k6",
            "type": "array",
            "value": Array [
              false,
            ],
          },
        ],
        "content": Array [
          Object {
            "content": Array [
              Object {
                "content": Array [
                  " foo",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_row",
            "type": "block",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 5,
            "offset": 80,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "name": "table",
        "text": "=begin table :k1 :!k2 :k3(True) :k4[True] :k5(False) :k6[False]
    foo
    =end table
    ",
        "type": "block",
      },
      Object {
        "type": "blankline",
      },
    ]
  `);
});

it("spec: 09-configuration 10", () => {
  const pod = `
=begin table :k1(1, 'b c', 2.3, True, False) :k2[1, 'b c', 2.3, True, False]
foo
=end table

`;
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 });
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "config": Array [
          Object {
            "name": "k1",
            "type": "array",
            "value": Array [
              1,
              "b c",
              2.3,
              true,
              false,
            ],
          },
          Object {
            "name": "k2",
            "type": "array",
            "value": Array [
              1,
              "b c",
              2.3,
              true,
              false,
            ],
          },
        ],
        "content": Array [
          Object {
            "content": Array [
              Object {
                "content": Array [
                  " foo",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_row",
            "type": "block",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 5,
            "offset": 93,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "name": "table",
        "text": "=begin table :k1(1, 'b c', 2.3, True, False) :k2[1, 'b c', 2.3, True, False]
    foo
    =end table
    ",
        "type": "block",
      },
      Object {
        "type": "blankline",
      },
    ]
  `);
});

it("spec: 09-configuration 11", () => {
  const pod = `
=begin table :k1{a => 1, 2 => 'b', c => True, d => 2.3, e => False}
foo
=end table

`;
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 });
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "config": Array [
          Object {
            "name": "k1",
            "value": Object {
              "2": "b",
              "a": 1,
              "c": true,
              "d": 2.3,
              "e": false,
            },
          },
        ],
        "content": Array [
          Object {
            "content": Array [
              Object {
                "content": Array [
                  " foo",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_row",
            "type": "block",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 5,
            "offset": 84,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "name": "table",
        "text": "=begin table :k1{a => 1, 2 => 'b', c => True, d => 2.3, e => False}
    foo
    =end table
    ",
        "type": "block",
      },
      Object {
        "type": "blankline",
      },
    ]
  `);
});

it("spec: 09-configuration 12", () => {
  const pod = `
=begin table :k1{2 => 'b => ?', c => ",", d => 2.3}
foo
=end table

`;
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 });
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "config": Array [
          Object {
            "name": "k1",
            "value": Object {
              "2": "b => ?",
              "c": ",",
              "d": 2.3,
            },
          },
        ],
        "content": Array [
          Object {
            "content": Array [
              Object {
                "content": Array [
                  " foo",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_row",
            "type": "block",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 5,
            "offset": 68,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "name": "table",
        "text": "=begin table :k1{2 => 'b => ?', c => \\",\\", d => 2.3}
    foo
    =end table
    ",
        "type": "block",
      },
      Object {
        "type": "blankline",
      },
    ]
  `);
});

it("spec: 09-configuration 13", () => {
  const pod = `
=begin table :k6[+999999999999999999999999999999] :k7[-999999999999999999999999999999]
foo
=end table

`;
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 });
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "config": Array [
          Object {
            "name": "k6",
            "type": "array",
            "value": Array [
              1e+30,
            ],
          },
          Object {
            "name": "k7",
            "type": "array",
            "value": Array [
              -1e+30,
            ],
          },
        ],
        "content": Array [
          Object {
            "content": Array [
              Object {
                "content": Array [
                  " foo",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_row",
            "type": "block",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 5,
            "offset": 103,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "name": "table",
        "text": "=begin table :k6[+999999999999999999999999999999] :k7[-999999999999999999999999999999]
    foo
    =end table
    ",
        "type": "block",
      },
      Object {
        "type": "blankline",
      },
    ]
  `);
});
