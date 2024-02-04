import { toTree, toHtml } from '../..'

it('spec: 08-formattingcodes 0', () => {
  const pod = `
=pod
B<I am a formatting code>

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
                  "I am a formatting code",
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
                "line": 4,
                "offset": 32,
              },
              "start": Object {
                "column": 1,
                "line": 2,
                "offset": 1,
              },
            },
            "margin": "",
            "text": "B<I am a formatting code>
    ",
            "type": "para",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 4,
            "offset": 32,
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

it('spec: 08-formattingcodes 1', () => {
  const pod = `
=pod
The basic C<ln> command is: C<ln> B<R<source_file> R<target_file>>

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
              "The basic ",
              Object {
                "content": Array [
                  "ln",
                ],
                "name": "C",
                "type": "fcode",
              },
              " command is: ",
              Object {
                "content": Array [
                  "ln",
                ],
                "name": "C",
                "type": "fcode",
              },
              " ",
              Object {
                "content": Array [
                  Object {
                    "content": Array [
                      "source_file",
                    ],
                    "name": "R",
                    "type": "fcode",
                  },
                  " ",
                  Object {
                    "content": Array [
                      "target_file",
                    ],
                    "name": "R",
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
                "line": 4,
                "offset": 73,
              },
              "start": Object {
                "column": 1,
                "line": 2,
                "offset": 1,
              },
            },
            "margin": "",
            "text": "The basic C<ln> command is: C<ln> B<R<source_file> R<target_file>>
    ",
            "type": "para",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 4,
            "offset": 73,
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

it('spec: 08-formattingcodes 2', () => {
  const pod = `
=pod
L<C<b>|a>
L<C<b>|a>

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
                      "b",
                    ],
                    "name": "C",
                    "type": "fcode",
                  },
                ],
                "meta": "a",
                "name": "L",
                "type": "fcode",
              },
              "
    ",
              Object {
                "content": Array [
                  Object {
                    "content": Array [
                      "b",
                    ],
                    "name": "C",
                    "type": "fcode",
                  },
                ],
                "meta": "a",
                "name": "L",
                "type": "fcode",
              },
              "
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 5,
                "offset": 26,
              },
              "start": Object {
                "column": 1,
                "line": 2,
                "offset": 1,
              },
            },
            "margin": "",
            "text": "L<C<b>|a>
    L<C<b>|a>
    ",
            "type": "para",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 5,
            "offset": 26,
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

it('spec: 08-formattingcodes 3', () => {
  const pod = `
=begin pod

=head1 A heading

This is Pod too. Specifically, this is a simple C<para> block

    $this = pod('also');  # Specifically, a code block

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
            "type": "blankline",
          },
          Object {
            "content": Array [
              Object {
                "content": Array [
                  "A heading
    ",
                ],
                "location": Object {
                  "end": Object {
                    "column": 1,
                    "line": 5,
                    "offset": 30,
                  },
                  "start": Object {
                    "column": 1,
                    "line": 4,
                    "offset": 13,
                  },
                },
                "margin": "",
                "text": "A heading
    ",
                "type": "para",
              },
            ],
            "level": "1",
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 5,
                "offset": 30,
              },
              "start": Object {
                "column": 1,
                "line": 4,
                "offset": 13,
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
              "This is Pod too. Specifically, this is a simple ",
              Object {
                "content": Array [
                  "para",
                ],
                "name": "C",
                "type": "fcode",
              },
              " block
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 7,
                "offset": 93,
              },
              "start": Object {
                "column": 1,
                "line": 6,
                "offset": 31,
              },
            },
            "margin": "",
            "text": "This is Pod too. Specifically, this is a simple C<para> block
    ",
            "type": "para",
          },
          Object {
            "type": "blankline",
          },
          Object {
            "content": Array [
              Object {
                "type": "verbatim",
                "value": "$this = pod('also');  # Specifically, a code block
    ",
              },
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 9,
                "offset": 149,
              },
              "start": Object {
                "column": 1,
                "line": 8,
                "offset": 94,
              },
            },
            "margin": "    ",
            "text": "$this = pod('also');  # Specifically, a code block
    ",
            "type": "code",
          },
          Object {
            "type": "blankline",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 11,
            "offset": 159,
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

it('spec: 08-formattingcodes 4', () => {
  const pod = `
=pod V<C<boo> B<bar> asd>

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
                "content": "C<boo> B<bar> asd",
                "name": "V",
                "type": "fcode",
              },
              "
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 3,
                "offset": 27,
              },
              "start": Object {
                "column": 1,
                "line": 2,
                "offset": 1,
              },
            },
            "margin": "",
            "text": "V<C<boo> B<bar> asd>
    ",
            "type": "para",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 3,
            "offset": 27,
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
