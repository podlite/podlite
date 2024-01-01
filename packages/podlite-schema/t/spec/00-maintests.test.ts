import { toTree, toHtml } from "../..";

it("spec: 00-maintests 0", () => {
  const pod = `
=begin pod
  =begin para
  sdsd
   sdasd
 
        ddsds
  d
  =end para
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
              Object {
                "content": Array [
                  "sdsd
       sdasd
    ",
                ],
                "location": Object {
                  "end": Object {
                    "column": 1,
                    "line": 6,
                    "offset": 42,
                  },
                  "start": Object {
                    "column": 1,
                    "line": 4,
                    "offset": 26,
                  },
                },
                "margin": "  ",
                "text": "sdsd
       sdasd
    ",
                "type": "para",
              },
              Object {
                "type": "blankline",
              },
              Object {
                "content": Array [
                  "ddsds
      d
    ",
                ],
                "location": Object {
                  "end": Object {
                    "column": 1,
                    "line": 9,
                    "offset": 62,
                  },
                  "start": Object {
                    "column": 1,
                    "line": 7,
                    "offset": 44,
                  },
                },
                "margin": "        ",
                "text": "ddsds
      d
    ",
                "type": "para",
              },
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 10,
                "offset": 74,
              },
              "start": Object {
                "column": 1,
                "line": 3,
                "offset": 12,
              },
            },
            "margin": "  ",
            "name": "para",
            "type": "block",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 11,
            "offset": 83,
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

it("spec: 00-maintests 1", () => {
  const pod = `
=begin pod
  twest
  =for para
  sdsdsdsd

  jjj
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
            "content": Array [
              Object {
                "type": "verbatim",
                "value": "twest
    ",
              },
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 4,
                "offset": 20,
              },
              "start": Object {
                "column": 1,
                "line": 3,
                "offset": 12,
              },
            },
            "margin": "  ",
            "text": "twest
    ",
            "type": "code",
          },
          Object {
            "config": Array [],
            "content": Array [
              Object {
                "content": Array [
                  "  sdsdsdsd
    ",
                ],
                "location": Object {
                  "end": Object {
                    "column": 1,
                    "line": 6,
                    "offset": 43,
                  },
                  "start": Object {
                    "column": 1,
                    "line": 4,
                    "offset": 20,
                  },
                },
                "margin": "  ",
                "text": "  sdsdsdsd
    ",
                "type": "para",
              },
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 6,
                "offset": 43,
              },
              "start": Object {
                "column": 1,
                "line": 4,
                "offset": 20,
              },
            },
            "margin": "  ",
            "name": "para",
            "type": "block",
          },
          Object {
            "type": "blankline",
          },
          Object {
            "content": Array [
              "jjj
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 8,
                "offset": 50,
              },
              "start": Object {
                "column": 1,
                "line": 7,
                "offset": 44,
              },
            },
            "margin": "  ",
            "text": "jjj
    ",
            "type": "para",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 9,
            "offset": 59,
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

it("spec: 00-maintests 2", () => {
  const pod = `
=begin pod
=for Named
  text
=begin Named
sdsdsdsd ssd s
  asdasdasdasd

dd
=end Named

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
              Object {
                "type": "verbatim",
                "value": "  text
    ",
              },
            ],
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
            "name": "Named",
            "type": "block",
          },
          Object {
            "config": Array [],
            "content": Array [
              Object {
                "type": "verbatim",
                "value": "sdsdsdsd ssd s
      asdasdasdasd

    dd
    ",
              },
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 11,
                "offset": 88,
              },
              "start": Object {
                "column": 1,
                "line": 5,
                "offset": 30,
              },
            },
            "margin": "",
            "name": "Named",
            "text": "=begin Named
    sdsdsdsd ssd s
      asdasdasdasd

    dd
    =end Named
    ",
            "type": "block",
          },
          Object {
            "type": "blankline",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 13,
            "offset": 98,
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

it("spec: 00-maintests 3", () => {
  const pod = `
=head1 Test

text

=head2 Testing
continue

test


`;
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 });
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "content": Array [
          Object {
            "content": Array [
              "Test
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 3,
                "offset": 13,
              },
              "start": Object {
                "column": 1,
                "line": 2,
                "offset": 1,
              },
            },
            "margin": "",
            "text": "Test
    ",
            "type": "para",
          },
        ],
        "level": "1",
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 3,
            "offset": 13,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "name": "head",
        "type": "block",
      },
      Object {
        "type": "blankline",
      },
      Object {
        "content": Array [
          "text
    ",
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 5,
            "offset": 19,
          },
          "start": Object {
            "column": 1,
            "line": 4,
            "offset": 14,
          },
        },
        "margin": "",
        "text": "text
    ",
        "type": "para",
      },
      Object {
        "type": "blankline",
      },
      Object {
        "content": Array [
          Object {
            "content": Array [
              "Testing
    continue
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 8,
                "offset": 44,
              },
              "start": Object {
                "column": 1,
                "line": 6,
                "offset": 20,
              },
            },
            "margin": "",
            "text": "Testing
    continue
    ",
            "type": "para",
          },
        ],
        "level": "2",
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 8,
            "offset": 44,
          },
          "start": Object {
            "column": 1,
            "line": 6,
            "offset": 20,
          },
        },
        "margin": "",
        "name": "head",
        "type": "block",
      },
      Object {
        "type": "blankline",
      },
      Object {
        "content": Array [
          "test
    ",
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 10,
            "offset": 50,
          },
          "start": Object {
            "column": 1,
            "line": 9,
            "offset": 45,
          },
        },
        "margin": "",
        "text": "test
    ",
        "type": "para",
      },
      Object {
        "type": "blankline",
      },
      Object {
        "type": "blankline",
      },
    ]
  `);
});

it("spec: 00-maintests 4", () => {
  const pod = `
=begin table :k1<str> :k2('str') :k3("str") :k4["str"] :k5(Q[str])

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
            "type": "blankline",
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
        "type": "block",
      },
      Object {
        "type": "blankline",
      },
    ]
  `);
});

it("spec: 00-maintests 5", () => {
  const pod = `
=config table :k1<very long string, comma> :k2<2 23  23 > :k3<'23', 23233, 333>

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
            "value": "very long string, comma",
          },
          Object {
            "name": "k2",
            "type": "array",
            "value": Array [
              2,
              23,
              23,
            ],
          },
          Object {
            "name": "k3",
            "type": "array",
            "value": Array [
              "23",
              23233,
              333,
            ],
          },
        ],
        "margin": "",
        "name": "table",
        "type": "config",
      },
      Object {
        "type": "blankline",
      },
    ]
  `);
});

it("spec: 00-maintests 6", () => {
  const pod = `
=code
  sdkljsalkdjlsd
  asdasdasdasdsad
=for code
  sdkljsalkdjlsd
  asdasdasdasdsad
=begin code
  sdkljsalkdjlsd
  asdasdasdasdsad
=end code

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
            "type": "verbatim",
            "value": "  sdkljsalkdjlsd
      asdasdasdasdsad
    ",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 5,
            "offset": 42,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "name": "code",
        "type": "block",
      },
      Object {
        "config": Array [],
        "content": Array [
          Object {
            "type": "verbatim",
            "value": "  sdkljsalkdjlsd
      asdasdasdasdsad
    ",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 8,
            "offset": 87,
          },
          "start": Object {
            "column": 1,
            "line": 5,
            "offset": 42,
          },
        },
        "margin": "",
        "name": "code",
        "type": "block",
      },
      Object {
        "config": Array [],
        "content": Array [
          Object {
            "type": "verbatim",
            "value": "  sdkljsalkdjlsd
      asdasdasdasdsad
    ",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 12,
            "offset": 144,
          },
          "start": Object {
            "column": 1,
            "line": 8,
            "offset": 87,
          },
        },
        "margin": "",
        "name": "code",
        "text": "=begin code
      sdkljsalkdjlsd
      asdasdasdasdsad
    =end code
    ",
        "type": "block",
      },
      Object {
        "type": "blankline",
      },
    ]
  `);
});

it("spec: 00-maintests 7", () => {
  const pod = `
=config C<>  :allow<B>

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
            "name": "allow",
            "type": "array",
            "value": Array [
              "B",
            ],
          },
        ],
        "margin": "",
        "name": "C<>",
        "type": "config",
      },
      Object {
        "type": "blankline",
      },
    ]
  `);
});

it("spec: 00-maintests 8", () => {
  const pod = `
=begin SYNOPSIS
Para inside SYNOPSIS
=end SYNOPSIS

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
            "content": Array [
              "Para inside SYNOPSIS
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 4,
                "offset": 38,
              },
              "start": Object {
                "column": 1,
                "line": 3,
                "offset": 17,
              },
            },
            "margin": "",
            "text": "Para inside SYNOPSIS
    ",
            "type": "para",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 5,
            "offset": 52,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "name": "SYNOPSIS",
        "type": "block",
      },
      Object {
        "type": "blankline",
      },
    ]
  `);
});

it("spec: 00-maintests 9", () => {
  const pod = `
=para
teZ<s>tZ<>

`;
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 });
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "content": Array [
          Object {
            "content": Array [
              "te",
              Object {
                "content": "s",
                "name": "Z",
                "type": "fcode",
              },
              "t",
              Object {
                "content": "",
                "name": "Z",
                "type": "fcode",
              },
              "
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 4,
                "offset": 18,
              },
              "start": Object {
                "column": 1,
                "line": 2,
                "offset": 1,
              },
            },
            "margin": "",
            "text": "teZ<s>tZ<>
    ",
            "type": "para",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 4,
            "offset": 18,
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
  `);
});

it("spec: 00-maintests 10", () => {
  const pod = `
=para
Use a C<for> loop instead.N<The Perl 6 C<for> loop is far more
powerful than its Perl 5 predecessor.> Preferably with an explicit
iterator variable.

`;
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 });
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "content": Array [
          Object {
            "content": Array [
              "Use a ",
              Object {
                "content": Array [
                  "for",
                ],
                "name": "C",
                "type": "fcode",
              },
              " loop instead.",
              Object {
                "content": Array [
                  "The Perl 6 ",
                  Object {
                    "content": Array [
                      "for",
                    ],
                    "name": "C",
                    "type": "fcode",
                  },
                  " loop is far more
    powerful than its Perl 5 predecessor.",
                ],
                "name": "N",
                "type": "fcode",
              },
              " Preferably with an explicit
    iterator variable.
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 6,
                "offset": 156,
              },
              "start": Object {
                "column": 1,
                "line": 2,
                "offset": 1,
              },
            },
            "margin": "",
            "text": "Use a C<for> loop instead.N<The Perl 6 C<for> loop is far more
    powerful than its Perl 5 predecessor.> Preferably with an explicit
    iterator variable.
    ",
            "type": "para",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 6,
            "offset": 156,
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
  `);
});

it("spec: 00-maintests 11", () => {
  const pod = `
=para
A X<hash|hashes, definition of; associative arrays>
is an unordered X<collection> of X<scalar|scalars> values indexed by their
associated string X<|puns, deliberate> key. X<> empty

`;
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 });
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "content": Array [
          Object {
            "content": Array [
              "A ",
              Object {
                "content": Array [
                  "hash",
                ],
                "entry": Array [
                  "hashes, definition of",
                  "associative arrays",
                ],
                "name": "X",
                "type": "fcode",
              },
              "
    is an unordered ",
              Object {
                "content": Array [
                  "collection",
                ],
                "entry": null,
                "name": "X",
                "type": "fcode",
              },
              " of ",
              Object {
                "content": Array [
                  "scalar",
                ],
                "entry": Array [
                  "scalars",
                ],
                "name": "X",
                "type": "fcode",
              },
              " values indexed by their
    associated string ",
              Object {
                "content": Array [],
                "entry": Array [
                  "puns, deliberate",
                ],
                "name": "X",
                "type": "fcode",
              },
              " key. ",
              Object {
                "content": Array [],
                "entry": null,
                "name": "X",
                "type": "fcode",
              },
              " empty
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 6,
                "offset": 188,
              },
              "start": Object {
                "column": 1,
                "line": 2,
                "offset": 1,
              },
            },
            "margin": "",
            "text": "A X<hash|hashes, definition of; associative arrays>
    is an unordered X<collection> of X<scalar|scalars> values indexed by their
    associated string X<|puns, deliberate> key. X<> empty
    ",
            "type": "para",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 6,
            "offset": 188,
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
  `);
});

it("spec: 00-maintests 12", () => {
  const pod = `
=para
The C<U<>> formatting code specifies that the contained text is
U<unusual> or distinctive;

`;
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 });
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "content": Array [
          Object {
            "content": Array [
              "The ",
              Object {
                "content": Array [
                  "U<>",
                ],
                "name": "C",
                "type": "fcode",
              },
              " formatting code specifies that the contained text is
    ",
              Object {
                "content": Array [
                  "unusual",
                ],
                "name": "U",
                "type": "fcode",
              },
              " or distinctive;
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 5,
                "offset": 98,
              },
              "start": Object {
                "column": 1,
                "line": 2,
                "offset": 1,
              },
            },
            "margin": "",
            "text": "The C<U<>> formatting code specifies that the contained text is
    U<unusual> or distinctive;
    ",
            "type": "para",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 5,
            "offset": 98,
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
  `);
});

it("spec: 00-maintests 13", () => {
  const pod = `
=para
Such content would typically be rendered in a K<fixed-width font>
Such content would typically be rendered in a T<fixed-width font>

`;
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 });
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "content": Array [
          Object {
            "content": Array [
              "Such content would typically be rendered in a ",
              Object {
                "content": Array [
                  "fixed-width font",
                ],
                "name": "K",
                "type": "fcode",
              },
              "
    Such content would typically be rendered in a ",
              Object {
                "content": Array [
                  "fixed-width font",
                ],
                "name": "T",
                "type": "fcode",
              },
              "
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 5,
                "offset": 139,
              },
              "start": Object {
                "column": 1,
                "line": 2,
                "offset": 1,
              },
            },
            "margin": "",
            "text": "Such content would typically be rendered in a K<fixed-width font>
    Such content would typically be rendered in a T<fixed-width font>
    ",
            "type": "para",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 5,
            "offset": 139,
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
  `);
});

it("spec: 00-maintests 14", () => {
  const pod = `
=d
Such content would typically be rendered in a K<fixed-width font>
Such content would typically be rendered in a T<fixed-width font>
=head1 test
=begin pod
test
e
=head1 sd

=end pod
=head2 test 

ambient again

`;
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 });
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "content": Array [
          "=d
    Such content would typically be rendered in a ",
          Object {
            "content": Array [
              "fixed-width font",
            ],
            "name": "K",
            "type": "fcode",
          },
          "
    Such content would typically be rendered in a ",
          Object {
            "content": Array [
              "fixed-width font",
            ],
            "name": "T",
            "type": "fcode",
          },
          "
    ",
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 5,
            "offset": 136,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "text": "=d
    Such content would typically be rendered in a K<fixed-width font>
    Such content would typically be rendered in a T<fixed-width font>
    ",
        "type": "para",
      },
      Object {
        "content": Array [
          Object {
            "content": Array [
              "test
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 6,
                "offset": 148,
              },
              "start": Object {
                "column": 1,
                "line": 5,
                "offset": 136,
              },
            },
            "margin": "",
            "text": "test
    ",
            "type": "para",
          },
        ],
        "level": "1",
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 6,
            "offset": 148,
          },
          "start": Object {
            "column": 1,
            "line": 5,
            "offset": 136,
          },
        },
        "margin": "",
        "name": "head",
        "type": "block",
      },
      Object {
        "config": Array [],
        "content": Array [
          Object {
            "content": Array [
              "test
    e
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 9,
                "offset": 166,
              },
              "start": Object {
                "column": 1,
                "line": 7,
                "offset": 159,
              },
            },
            "margin": "",
            "text": "test
    e
    ",
            "type": "para",
          },
          Object {
            "content": Array [
              Object {
                "content": Array [
                  "sd
    ",
                ],
                "location": Object {
                  "end": Object {
                    "column": 1,
                    "line": 10,
                    "offset": 176,
                  },
                  "start": Object {
                    "column": 1,
                    "line": 9,
                    "offset": 166,
                  },
                },
                "margin": "",
                "text": "sd
    ",
                "type": "para",
              },
            ],
            "level": "1",
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 10,
                "offset": 176,
              },
              "start": Object {
                "column": 1,
                "line": 9,
                "offset": 166,
              },
            },
            "margin": "",
            "name": "head",
            "type": "block",
          },
          Object {
            "type": "blankline",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 12,
            "offset": 186,
          },
          "start": Object {
            "column": 1,
            "line": 6,
            "offset": 148,
          },
        },
        "margin": "",
        "name": "pod",
        "type": "block",
      },
      Object {
        "content": Array [
          Object {
            "content": Array [
              "test 
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 13,
                "offset": 199,
              },
              "start": Object {
                "column": 1,
                "line": 12,
                "offset": 186,
              },
            },
            "margin": "",
            "text": "test 
    ",
            "type": "para",
          },
        ],
        "level": "2",
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 13,
            "offset": 199,
          },
          "start": Object {
            "column": 1,
            "line": 12,
            "offset": 186,
          },
        },
        "margin": "",
        "name": "head",
        "type": "block",
      },
      Object {
        "type": "blankline",
      },
      Object {
        "content": Array [
          "ambient again
    ",
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 15,
            "offset": 214,
          },
          "start": Object {
            "column": 1,
            "line": 14,
            "offset": 200,
          },
        },
        "margin": "",
        "text": "ambient again
    ",
        "type": "para",
      },
      Object {
        "type": "blankline",
      },
    ]
  `);
});

it("spec: 00-maintests 15", () => {
  const pod = `
=begin pod
=item

test

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
            "content": Array [
              Object {
                "content": Array [],
                "level": 1,
                "location": Object {
                  "end": Object {
                    "column": 1,
                    "line": 4,
                    "offset": 18,
                  },
                  "start": Object {
                    "column": 1,
                    "line": 3,
                    "offset": 12,
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
          Object {
            "content": Array [
              "test
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 6,
                "offset": 24,
              },
              "start": Object {
                "column": 1,
                "line": 5,
                "offset": 19,
              },
            },
            "margin": "",
            "text": "test
    ",
            "type": "para",
          },
          Object {
            "type": "blankline",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 8,
            "offset": 34,
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

it("spec: 00-maintests 16", () => {
  const pod = `
=begin code
=begin item1
First
=end item1
=end code

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
            "type": "verbatim",
            "value": "=begin item1
    First
    =end item1
    ",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 7,
            "offset": 53,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "name": "code",
        "text": "=begin code
    =begin item1
    First
    =end item1
    =end code
    ",
        "type": "block",
      },
      Object {
        "type": "blankline",
      },
    ]
  `);
});
