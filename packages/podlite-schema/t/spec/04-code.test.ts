import { toTree, toHtml } from '../..'

it('spec: 04-code 0', () => {
  const pod = `
=begin pod
This ordinary paragraph introduces a code block:

    $this = 1 * code('block');
    $which.is_specified(:by<indenting>);


    $which.spans(:newlines);

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
            "content": Array [
              "This ordinary paragraph introduces a code block:
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 4,
                "offset": 61,
              },
              "start": Object {
                "column": 1,
                "line": 3,
                "offset": 12,
              },
            },
            "margin": "",
            "text": "This ordinary paragraph introduces a code block:
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
                "value": "$this = 1 * code('block');
        $which.is_specified(:by<indenting>);
    ",
              },
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 7,
                "offset": 134,
              },
              "start": Object {
                "column": 1,
                "line": 5,
                "offset": 62,
              },
            },
            "margin": "    ",
            "text": "$this = 1 * code('block');
    $which.is_specified(:by<indenting>);
    ",
            "type": "code",
          },
          Object {
            "type": "blankline",
          },
          Object {
            "type": "blankline",
          },
          Object {
            "content": Array [
              Object {
                "type": "verbatim",
                "value": "$which.spans(:newlines);
    ",
              },
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 10,
                "offset": 165,
              },
              "start": Object {
                "column": 1,
                "line": 9,
                "offset": 136,
              },
            },
            "margin": "    ",
            "text": "$which.spans(:newlines);
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
            "line": 12,
            "offset": 175,
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

it('spec: 04-code 1', () => {
  const pod = `
=begin pod
This is an ordinary paragraph

    While this is not
    This is a code block

    =head1 Mumble mumble

    Suprisingly, this is not a code block
        (with fancy indentation too)

But this is just a text. Again

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
            "content": Array [
              "This is an ordinary paragraph
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 4,
                "offset": 42,
              },
              "start": Object {
                "column": 1,
                "line": 3,
                "offset": 12,
              },
            },
            "margin": "",
            "text": "This is an ordinary paragraph
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
                "value": "While this is not
        This is a code block
    ",
              },
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 7,
                "offset": 90,
              },
              "start": Object {
                "column": 1,
                "line": 5,
                "offset": 43,
              },
            },
            "margin": "    ",
            "text": "While this is not
    This is a code block
    ",
            "type": "code",
          },
          Object {
            "type": "blankline",
          },
          Object {
            "content": Array [
              Object {
                "content": Array [
                  "Mumble mumble
    ",
                ],
                "location": Object {
                  "end": Object {
                    "column": 1,
                    "line": 9,
                    "offset": 116,
                  },
                  "start": Object {
                    "column": 1,
                    "line": 8,
                    "offset": 91,
                  },
                },
                "margin": "",
                "text": "Mumble mumble
    ",
                "type": "para",
              },
            ],
            "level": "1",
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 9,
                "offset": 116,
              },
              "start": Object {
                "column": 1,
                "line": 8,
                "offset": 91,
              },
            },
            "margin": "    ",
            "name": "head",
            "type": "block",
          },
          Object {
            "type": "blankline",
          },
          Object {
            "content": Array [
              "Suprisingly, this is not a code block
            (with fancy indentation too)
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 12,
                "offset": 196,
              },
              "start": Object {
                "column": 1,
                "line": 10,
                "offset": 117,
              },
            },
            "margin": "    ",
            "text": "Suprisingly, this is not a code block
            (with fancy indentation too)
    ",
            "type": "para",
          },
          Object {
            "type": "blankline",
          },
          Object {
            "content": Array [
              "But this is just a text. Again
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 14,
                "offset": 228,
              },
              "start": Object {
                "column": 1,
                "line": 13,
                "offset": 197,
              },
            },
            "margin": "",
            "text": "But this is just a text. Again
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
            "line": 16,
            "offset": 238,
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

it('spec: 04-code 2', () => {
  const pod = `
=begin pod

Tests for the feed operators

    ==> and <==
    
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
              "Tests for the feed operators
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 5,
                "offset": 42,
              },
              "start": Object {
                "column": 1,
                "line": 4,
                "offset": 13,
              },
            },
            "margin": "",
            "text": "Tests for the feed operators
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
                "value": "==> and <==
    ",
              },
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 7,
                "offset": 59,
              },
              "start": Object {
                "column": 1,
                "line": 6,
                "offset": 43,
              },
            },
            "margin": "    ",
            "text": "==> and <==
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
            "line": 9,
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

it('spec: 04-code 3', () => {
  const pod = `
=begin pod
Fun comes

    This is code
  Ha, what now?

 one more block of code
 just to make sure it works
  or better: maybe it'll break!
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
            "content": Array [
              "Fun comes
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 4,
                "offset": 22,
              },
              "start": Object {
                "column": 1,
                "line": 3,
                "offset": 12,
              },
            },
            "margin": "",
            "text": "Fun comes
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
                "value": "This is code
      Ha, what now?
    ",
              },
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 7,
                "offset": 56,
              },
              "start": Object {
                "column": 1,
                "line": 5,
                "offset": 23,
              },
            },
            "margin": "    ",
            "text": "This is code
    Ha, what now?
    ",
            "type": "code",
          },
          Object {
            "type": "blankline",
          },
          Object {
            "content": Array [
              Object {
                "type": "verbatim",
                "value": "one more block of code
     just to make sure it works
      or better: maybe it'll break!
    ",
              },
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 11,
                "offset": 141,
              },
              "start": Object {
                "column": 1,
                "line": 8,
                "offset": 57,
              },
            },
            "margin": " ",
            "text": "one more block of code
    just to make sure it works
     or better: maybe it'll break!
    ",
            "type": "code",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 12,
            "offset": 150,
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

it('spec: 04-code 4', () => {
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

it('spec: 04-code 5', () => {
  const pod = `
=begin pod
    this is code

    =for Podcast
        this is not

    this is not code either

    =begin Itemization
        this is not
    =end Itemization

    =begin Quitem
        and this is not
    =end Quitem

    =begin item
        and this is!
    =end item
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
            "content": Array [
              Object {
                "type": "verbatim",
                "value": "this is code
    ",
              },
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 4,
                "offset": 29,
              },
              "start": Object {
                "column": 1,
                "line": 3,
                "offset": 12,
              },
            },
            "margin": "    ",
            "text": "this is code
    ",
            "type": "code",
          },
          Object {
            "type": "blankline",
          },
          Object {
            "config": Array [],
            "content": Array [
              Object {
                "type": "verbatim",
                "value": "        this is not
    ",
              },
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 7,
                "offset": 67,
              },
              "start": Object {
                "column": 1,
                "line": 5,
                "offset": 30,
              },
            },
            "margin": "    ",
            "name": "Podcast",
            "type": "block",
          },
          Object {
            "type": "blankline",
          },
          Object {
            "content": Array [
              "this is not code either
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 9,
                "offset": 96,
              },
              "start": Object {
                "column": 1,
                "line": 8,
                "offset": 68,
              },
            },
            "margin": "    ",
            "text": "this is not code either
    ",
            "type": "para",
          },
          Object {
            "type": "blankline",
          },
          Object {
            "config": Array [],
            "content": Array [
              Object {
                "type": "verbatim",
                "value": "    this is not
    ",
              },
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 13,
                "offset": 161,
              },
              "start": Object {
                "column": 1,
                "line": 10,
                "offset": 97,
              },
            },
            "margin": "    ",
            "name": "Itemization",
            "text": "    =begin Itemization
            this is not
        =end Itemization
    ",
            "type": "block",
          },
          Object {
            "type": "blankline",
          },
          Object {
            "config": Array [],
            "content": Array [
              Object {
                "type": "verbatim",
                "value": "    and this is not
    ",
              },
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 17,
                "offset": 220,
              },
              "start": Object {
                "column": 1,
                "line": 14,
                "offset": 162,
              },
            },
            "margin": "    ",
            "name": "Quitem",
            "text": "    =begin Quitem
            and this is not
        =end Quitem
    ",
            "type": "block",
          },
          Object {
            "type": "blankline",
          },
          Object {
            "content": Array [
              Object {
                "config": Array [],
                "content": Array [
                  Object {
                    "content": Array [
                      "and this is!
    ",
                    ],
                    "location": Object {
                      "end": Object {
                        "column": 1,
                        "line": 20,
                        "offset": 258,
                      },
                      "start": Object {
                        "column": 1,
                        "line": 19,
                        "offset": 237,
                      },
                    },
                    "margin": "        ",
                    "text": "and this is!
    ",
                    "type": "code",
                  },
                ],
                "level": 1,
                "location": Object {
                  "end": Object {
                    "column": 1,
                    "line": 21,
                    "offset": 272,
                  },
                  "start": Object {
                    "column": 1,
                    "line": 18,
                    "offset": 221,
                  },
                },
                "margin": "    ",
                "name": "item",
                "type": "block",
              },
            ],
            "level": 1,
            "list": "itemized",
            "type": "list",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 22,
            "offset": 281,
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

it('spec: 04-code 6', () => {
  const pod = `
=begin code
    foo foo
    =begin code
    =end code
=end code

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
            "type": "verbatim",
            "value": "    foo foo
        =begin code
        =end code
    ",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 7,
            "offset": 65,
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
        foo foo
        =begin code
        =end code
    =end code
    ",
        "type": "block",
      },
      Object {
        "type": "blankline",
      },
    ]
  `)
})
