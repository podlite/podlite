import { toTree, toHtml } from '../..'

it('spec: 03-abbreviated 0', () => {
  const pod = `
=foo

`
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 })
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "content": Array [
          "=foo
    ",
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 3,
            "offset": 6,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "text": "=foo
    ",
        "type": "para",
      },
      Object {
        "type": "blankline",
      },
    ]
  `)
})

it('spec: 03-abbreviated 1', () => {
  const pod = `
=foo some text

`
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 })
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "content": Array [
          "=foo some text
    ",
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 3,
            "offset": 16,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "text": "=foo some text
    ",
        "type": "para",
      },
      Object {
        "type": "blankline",
      },
    ]
  `)
})

it('spec: 03-abbreviated 2', () => {
  const pod = `
=foo some text
and some more

`
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 })
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "content": Array [
          "=foo some text
    and some more
    ",
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 4,
            "offset": 30,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "text": "=foo some text
    and some more
    ",
        "type": "para",
      },
      Object {
        "type": "blankline",
      },
    ]
  `)
})

it('spec: 03-abbreviated 3', () => {
  const pod = `
=begin pod

=got Inside
got

=bidden Inside
bidden

Outside blocks
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
              "=got Inside
    got
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 6,
                "offset": 29,
              },
              "start": Object {
                "column": 1,
                "line": 4,
                "offset": 13,
              },
            },
            "margin": "",
            "text": "=got Inside
    got
    ",
            "type": "para",
          },
          Object {
            "type": "blankline",
          },
          Object {
            "content": Array [
              "=bidden Inside
    bidden
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 9,
                "offset": 52,
              },
              "start": Object {
                "column": 1,
                "line": 7,
                "offset": 30,
              },
            },
            "margin": "",
            "text": "=bidden Inside
    bidden
    ",
            "type": "para",
          },
          Object {
            "type": "blankline",
          },
          Object {
            "content": Array [
              "Outside blocks
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 11,
                "offset": 68,
              },
              "start": Object {
                "column": 1,
                "line": 10,
                "offset": 53,
              },
            },
            "margin": "",
            "text": "Outside blocks
    ",
            "type": "para",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 12,
            "offset": 77,
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

it('spec: 03-abbreviated 4', () => {
  const pod = `
=begin pod
    =begin one
    one, delimited block
    =end one
    =two two,
    paragraph block
    =for three
    three, still a parablock

    =begin four
    four, another delimited one
    =end four
    =head1 And just for the sake of having a working =head1 :)
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
                "value": "=begin one
        one, delimited block
        =end one
        =two two,
        paragraph block
        =for three
        three, still a parablock
    ",
              },
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 10,
                "offset": 143,
              },
              "start": Object {
                "column": 1,
                "line": 3,
                "offset": 12,
              },
            },
            "margin": "    ",
            "text": "=begin one
    one, delimited block
    =end one
    =two two,
    paragraph block
    =for three
    three, still a parablock
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
                "value": "=begin four
        four, another delimited one
        =end four
    ",
              },
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 14,
                "offset": 206,
              },
              "start": Object {
                "column": 1,
                "line": 11,
                "offset": 144,
              },
            },
            "margin": "    ",
            "text": "=begin four
    four, another delimited one
    =end four
    ",
            "type": "code",
          },
          Object {
            "content": Array [
              Object {
                "content": Array [
                  "And just for the sake of having a working =head1 :)
    ",
                ],
                "location": Object {
                  "end": Object {
                    "column": 1,
                    "line": 15,
                    "offset": 269,
                  },
                  "start": Object {
                    "column": 1,
                    "line": 14,
                    "offset": 206,
                  },
                },
                "margin": "",
                "text": "And just for the sake of having a working =head1 :)
    ",
                "type": "para",
              },
            ],
            "level": "1",
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 15,
                "offset": 269,
              },
              "start": Object {
                "column": 1,
                "line": 14,
                "offset": 206,
              },
            },
            "margin": "    ",
            "name": "head",
            "type": "block",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 16,
            "offset": 278,
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

it('spec: 03-abbreviated 5', () => {
  const pod = `
=begin foo
and so,  all  of  the  villages chased
Albi,   The   Racist  Dragon, into the
very   cold   and  very  scary    cave

and it was so cold and so scary in
there,  that  Albi  began  to  cry

    =bold Dragon Tears!

Which, as we all know...

    =bold Turn
          into
          Jelly
          Beans!
=end foo

`
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 })
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "content": Array [
          "=begin foo
    and so,  all  of  the  villages chased
    Albi,   The   Racist  Dragon, into the
    very   cold   and  very  scary    cave
    ",
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 6,
            "offset": 129,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "text": "=begin foo
    and so,  all  of  the  villages chased
    Albi,   The   Racist  Dragon, into the
    very   cold   and  very  scary    cave
    ",
        "type": "para",
      },
      Object {
        "type": "blankline",
      },
      Object {
        "content": Array [
          "and it was so cold and so scary in
    there,  that  Albi  began  to  cry
    ",
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 9,
            "offset": 200,
          },
          "start": Object {
            "column": 1,
            "line": 7,
            "offset": 130,
          },
        },
        "margin": "",
        "text": "and it was so cold and so scary in
    there,  that  Albi  began  to  cry
    ",
        "type": "para",
      },
      Object {
        "type": "blankline",
      },
      Object {
        "content": Array [
          "    =bold Dragon Tears!
    ",
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 11,
            "offset": 225,
          },
          "start": Object {
            "column": 1,
            "line": 10,
            "offset": 201,
          },
        },
        "margin": "",
        "text": "    =bold Dragon Tears!
    ",
        "type": "para",
      },
      Object {
        "type": "blankline",
      },
      Object {
        "content": Array [
          "Which, as we all know...
    ",
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 13,
            "offset": 251,
          },
          "start": Object {
            "column": 1,
            "line": 12,
            "offset": 226,
          },
        },
        "margin": "",
        "text": "Which, as we all know...
    ",
        "type": "para",
      },
      Object {
        "type": "blankline",
      },
      Object {
        "content": Array [
          "    =bold Turn
              into
              Jelly
              Beans!
    =end foo
    ",
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 19,
            "offset": 324,
          },
          "start": Object {
            "column": 1,
            "line": 14,
            "offset": 252,
          },
        },
        "margin": "",
        "text": "    =bold Turn
              into
              Jelly
              Beans!
    =end foo
    ",
        "type": "para",
      },
      Object {
        "type": "blankline",
      },
    ]
  `)
})

it('spec: 03-abbreviated 6', () => {
  const pod = `
=table_not
    Constants 1
    Variables 10
    Subroutines 33
    Everything else 57

`
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 })
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "content": Array [
          "=table_not
        Constants 1
        Variables 10
        Subroutines 33
        Everything else 57
    ",
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 7,
            "offset": 87,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "text": "=table_not
        Constants 1
        Variables 10
        Subroutines 33
        Everything else 57
    ",
        "type": "para",
      },
      Object {
        "type": "blankline",
      },
    ]
  `)
})

it('spec: 03-abbreviated 7', () => {
  const pod = `
=head3
Heading level 3

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
              "Heading level 3
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 4,
                "offset": 24,
              },
              "start": Object {
                "column": 1,
                "line": 2,
                "offset": 1,
              },
            },
            "margin": "",
            "text": "Heading level 3
    ",
            "type": "para",
          },
        ],
        "level": "3",
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 4,
            "offset": 24,
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
    ]
  `)
})
