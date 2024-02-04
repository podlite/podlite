import { toTree, toHtml } from '../..'

it('spec: 01-delimited 0', () => {
  const pod = `
=begin foo
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
    =end foo
    ",
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 4,
            "offset": 21,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "text": "=begin foo
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

it('spec: 01-delimited 1', () => {
  const pod = `
=begin foo
some text
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
    some text
    =end foo
    ",
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 5,
            "offset": 31,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "text": "=begin foo
    some text
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

it('spec: 01-delimited 2', () => {
  const pod = `
=begin foo
some
spaced   text
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
    some
    spaced   text
    =end foo
    ",
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 6,
            "offset": 40,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "text": "=begin foo
    some
    spaced   text
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

it('spec: 01-delimited 3', () => {
  const pod = `
=begin foo
paragraph one

paragraph
two
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
    paragraph one
    ",
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 4,
            "offset": 26,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "text": "=begin foo
    paragraph one
    ",
        "type": "para",
      },
      Object {
        "type": "blankline",
      },
      Object {
        "content": Array [
          "paragraph
    two
    =end foo
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
            "line": 5,
            "offset": 27,
          },
        },
        "margin": "",
        "text": "paragraph
    two
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

it('spec: 01-delimited 4', () => {
  const pod = `
=begin something
    =begin somethingelse
    toot tooot!
    =end somethingelse
=end something

`
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 })
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "content": Array [
          "=begin something
        =begin somethingelse
        toot tooot!
        =end somethingelse
    =end something
    ",
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 7,
            "offset": 97,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "text": "=begin something
        =begin somethingelse
        toot tooot!
        =end somethingelse
    =end something
    ",
        "type": "para",
      },
      Object {
        "type": "blankline",
      },
    ]
  `)
})

it('spec: 01-delimited 5', () => {
  const pod = `
=begin foo
and so,  all  of  the  villages chased
Albi,   The   Racist  Dragon, into the
very   cold   and  very  scary    cave

and it was so cold and so scary in
there,  that  Albi  began  to  cry

    =begin bar
Dragon Tears!

    =end bar

Which, as we all know...

    =begin bar
    Turn into Jelly Beans!
    =end bar
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
          "    =begin bar
    Dragon Tears!
    ",
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 12,
            "offset": 230,
          },
          "start": Object {
            "column": 1,
            "line": 10,
            "offset": 201,
          },
        },
        "margin": "",
        "text": "    =begin bar
    Dragon Tears!
    ",
        "type": "para",
      },
      Object {
        "type": "blankline",
      },
      Object {
        "content": Array [
          "    =end bar
    ",
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 14,
            "offset": 244,
          },
          "start": Object {
            "column": 1,
            "line": 13,
            "offset": 231,
          },
        },
        "margin": "",
        "text": "    =end bar
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
            "line": 16,
            "offset": 270,
          },
          "start": Object {
            "column": 1,
            "line": 15,
            "offset": 245,
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
          "    =begin bar
        Turn into Jelly Beans!
        =end bar
    =end foo
    ",
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 21,
            "offset": 335,
          },
          "start": Object {
            "column": 1,
            "line": 17,
            "offset": 271,
          },
        },
        "margin": "",
        "text": "    =begin bar
        Turn into Jelly Beans!
        =end bar
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

it('spec: 01-delimited 6', () => {
  const pod = `
=begin pod

someone accidentally left a space
 
between these two paragraphs

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
              "someone accidentally left a space
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 5,
                "offset": 47,
              },
              "start": Object {
                "column": 1,
                "line": 4,
                "offset": 13,
              },
            },
            "margin": "",
            "text": "someone accidentally left a space
    ",
            "type": "para",
          },
          Object {
            "type": "blankline",
          },
          Object {
            "content": Array [
              "between these two paragraphs
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 7,
                "offset": 78,
              },
              "start": Object {
                "column": 1,
                "line": 6,
                "offset": 49,
              },
            },
            "margin": "",
            "text": "between these two paragraphs
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
            "line": 9,
            "offset": 88,
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

it('spec: 01-delimited 7', () => {
  const pod = `
=begin kwid

= DESCRIPTION
bla bla

foo
=end kwid

`
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 })
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "content": Array [
          "=begin kwid
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
        "text": "=begin kwid
    ",
        "type": "para",
      },
      Object {
        "type": "blankline",
      },
      Object {
        "content": Array [
          "= DESCRIPTION
    bla bla
    ",
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 6,
            "offset": 36,
          },
          "start": Object {
            "column": 1,
            "line": 4,
            "offset": 14,
          },
        },
        "margin": "",
        "text": "= DESCRIPTION
    bla bla
    ",
        "type": "para",
      },
      Object {
        "type": "blankline",
      },
      Object {
        "content": Array [
          "foo
    =end kwid
    ",
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 9,
            "offset": 51,
          },
          "start": Object {
            "column": 1,
            "line": 7,
            "offset": 37,
          },
        },
        "margin": "",
        "text": "foo
    =end kwid
    ",
        "type": "para",
      },
      Object {
        "type": "blankline",
      },
    ]
  `)
})

it('spec: 01-delimited 8', () => {
  const pod = `
=begin more-discussion-needed

XXX: chop(@array) should return an array of chopped strings?
XXX: chop(%has)   should return a  hash  of chopped strings?

=end more-discussion-needed

`
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 })
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "content": Array [
          "=begin more-discussion-needed
    ",
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 3,
            "offset": 31,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "text": "=begin more-discussion-needed
    ",
        "type": "para",
      },
      Object {
        "type": "blankline",
      },
      Object {
        "content": Array [
          "XXX: chop(@array) should return an array of chopped strings?
    XXX: chop(%has)   should return a  hash  of chopped strings?
    ",
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 6,
            "offset": 154,
          },
          "start": Object {
            "column": 1,
            "line": 4,
            "offset": 32,
          },
        },
        "margin": "",
        "text": "XXX: chop(@array) should return an array of chopped strings?
    XXX: chop(%has)   should return a  hash  of chopped strings?
    ",
        "type": "para",
      },
      Object {
        "type": "blankline",
      },
      Object {
        "content": Array [
          "=end more-discussion-needed
    ",
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 8,
            "offset": 183,
          },
          "start": Object {
            "column": 1,
            "line": 7,
            "offset": 155,
          },
        },
        "margin": "",
        "text": "=end more-discussion-needed
    ",
        "type": "para",
      },
      Object {
        "type": "blankline",
      },
    ]
  `)
})

it('spec: 01-delimited 9', () => {
  const pod = `
=begin pod
    =head1 This is a heading block

    This is an ordinary paragraph.
    Its text  will   be     squeezed     and
    short lines filled. It is terminated by
    the first blank line.

    This is another ordinary paragraph.
    Its     text    will  also be squeezed and
    short lines filled. It is terminated by
    the trailing directive on the next line.
        =head2 This is another heading block

        This is yet another ordinary paragraph,
        at the first virtual column set by the
        previous directive
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
                "content": Array [
                  "This is a heading block
    ",
                ],
                "location": Object {
                  "end": Object {
                    "column": 1,
                    "line": 4,
                    "offset": 47,
                  },
                  "start": Object {
                    "column": 1,
                    "line": 3,
                    "offset": 12,
                  },
                },
                "margin": "",
                "text": "This is a heading block
    ",
                "type": "para",
              },
            ],
            "level": "1",
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 4,
                "offset": 47,
              },
              "start": Object {
                "column": 1,
                "line": 3,
                "offset": 12,
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
              "This is an ordinary paragraph.
        Its text  will   be     squeezed     and
        short lines filled. It is terminated by
        the first blank line.
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 9,
                "offset": 198,
              },
              "start": Object {
                "column": 1,
                "line": 5,
                "offset": 48,
              },
            },
            "margin": "    ",
            "text": "This is an ordinary paragraph.
        Its text  will   be     squeezed     and
        short lines filled. It is terminated by
        the first blank line.
    ",
            "type": "para",
          },
          Object {
            "type": "blankline",
          },
          Object {
            "content": Array [
              "This is another ordinary paragraph.
        Its     text    will  also be squeezed and
        short lines filled. It is terminated by
        the trailing directive on the next line.
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 14,
                "offset": 375,
              },
              "start": Object {
                "column": 1,
                "line": 10,
                "offset": 199,
              },
            },
            "margin": "    ",
            "text": "This is another ordinary paragraph.
        Its     text    will  also be squeezed and
        short lines filled. It is terminated by
        the trailing directive on the next line.
    ",
            "type": "para",
          },
          Object {
            "content": Array [
              Object {
                "content": Array [
                  "This is another heading block
    ",
                ],
                "location": Object {
                  "end": Object {
                    "column": 1,
                    "line": 15,
                    "offset": 420,
                  },
                  "start": Object {
                    "column": 1,
                    "line": 14,
                    "offset": 375,
                  },
                },
                "margin": "",
                "text": "This is another heading block
    ",
                "type": "para",
              },
            ],
            "level": "2",
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 15,
                "offset": 420,
              },
              "start": Object {
                "column": 1,
                "line": 14,
                "offset": 375,
              },
            },
            "margin": "        ",
            "name": "head",
            "type": "block",
          },
          Object {
            "type": "blankline",
          },
          Object {
            "content": Array [
              "This is yet another ordinary paragraph,
            at the first virtual column set by the
            previous directive
    ",
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 19,
                "offset": 543,
              },
              "start": Object {
                "column": 1,
                "line": 16,
                "offset": 421,
              },
            },
            "margin": "        ",
            "text": "This is yet another ordinary paragraph,
            at the first virtual column set by the
            previous directive
    ",
            "type": "para",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 20,
            "offset": 552,
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
