import { toTree, toHtml } from '../..'

it('spec: 07-tables 0', () => {
  const pod = `
=begin table
        The Shoveller   Eddie Stevens     King Arthur's singing shovel
        Blue Raja       Geoffrey Smith    Master of cutlery
        Mr Furious      Roy Orson         Ticking time bomb of fury
        The Bowler      Carol Pinnsler    Haunted bowling ball
=end table

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
                  " The Shoveller",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Eddie Stevens ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " King Arthur's singing shovel",
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
                  " Blue Raja    ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Geoffrey Smith",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Master of cutlery",
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
                  " Mr Furious   ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Roy Orson     ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Ticking time bomb of fury",
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
                  " The Bowler   ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Carol Pinnsler",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Haunted bowling ball",
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
            "line": 8,
            "offset": 287,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "name": "table",
        "text": "=begin table
            The Shoveller   Eddie Stevens     King Arthur's singing shovel
            Blue Raja       Geoffrey Smith    Master of cutlery
            Mr Furious      Roy Orson         Ticking time bomb of fury
            The Bowler      Carol Pinnsler    Haunted bowling ball
    =end table
    ",
        "type": "block",
      },
      Object {
        "type": "blankline",
      },
    ]
  `)
})

it('spec: 07-tables 1', () => {
  const pod = `
=table
    Constants           1
    Variables           10
    Subroutines         33
    Everything else     57

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
                  " Constants      ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " 1",
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
                  " Variables      ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " 10",
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
                  " Subroutines    ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " 33",
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
                  " Everything else",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " 57",
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
            "line": 7,
            "offset": 115,
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
  `)
})

it('spec: 07-tables 2', () => {
  const pod = `
=for table
    mouse    | mice
    horse    | horses
    elephant | elephants

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
                  " mouse   ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " mice",
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
                  " horse   ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " horses",
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
                  " elephant",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " elephants",
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
            "line": 6,
            "offset": 79,
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
  `)
})

it('spec: 07-tables 3', () => {
  const pod = `
=table
    Animal | Legs |    Eats
    =======================
    Zebra  +   4  + Cookies
    Human  +   2  +   Pizza
    Shark  +   0  +    Fish

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
                "name": "header",
                "type": "boolean",
                "value": true,
              },
            ],
            "content": Array [
              Object {
                "content": Array [
                  " Animal",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Legs",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  "    Eats",
                ],
                "name": "cell",
                "type": "block",
              },
            ],
            "name": "row",
            "type": "block",
          },
          Object {
            "text": "    =======================
    ",
            "type": "separator",
          },
          Object {
            "content": Array [
              Object {
                "content": Array [
                  " Zebra ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  "   4 ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Cookies",
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
                  " Human ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  "   2 ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  "   Pizza",
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
                  " Shark ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  "   0 ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  "    Fish",
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
            "line": 8,
            "offset": 148,
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
  `)
})

it('spec: 07-tables 4', () => {
  const pod = `
=table
        Superhero     | Secret          |
                      | Identity        | Superpower
        ==============|=================|================================
        The Shoveller | Eddie Stevens   | King Arthur's singing shovel

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
                "name": "header",
                "type": "boolean",
                "value": true,
              },
            ],
            "content": Array [
              Object {
                "content": Array [
                  " Superhero                  ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Secret        Identity     ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  "  Superpower",
                ],
                "name": "cell",
                "type": "block",
              },
            ],
            "name": "row",
            "type": "block",
          },
          Object {
            "text": "        ==============|=================|================================
    ",
            "type": "separator",
          },
          Object {
            "content": Array [
              Object {
                "content": Array [
                  " The Shoveller",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Eddie Stevens",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " King Arthur's singing shovel",
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
            "line": 7,
            "offset": 248,
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
  `)
})

it('spec: 07-tables 5', () => {
  const pod = `
=begin table

                        Secret
        Superhero       Identity          Superpower
        =============   ===============   ===================
        The Shoveller   Eddie Stevens     King Arthur's
                                          singing shovel

        Blue Raja       Geoffrey Smith    Master of cutlery

        Mr Furious      Roy Orson         Ticking time bomb
                                          of fury

        The Bowler      Carol Pinnsler    Haunted bowling ball

=end table

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
                "name": "header",
                "type": "boolean",
                "value": true,
              },
            ],
            "content": Array [
              Object {
                "content": Array [
                  "               Superhero    ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Secret Identity      ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  "  Superpower",
                ],
                "name": "cell",
                "type": "block",
              },
            ],
            "name": "row",
            "type": "block",
          },
          Object {
            "text": "        =============   ===============   ===================
    ",
            "type": "separator",
          },
          Object {
            "content": Array [
              Object {
                "content": Array [
                  " The Shoveller              ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Eddie Stevens                ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " King Arthur's singing shovel",
                ],
                "name": "cell",
                "type": "block",
              },
            ],
            "name": "row",
            "type": "block",
          },
          Object {
            "text": "
    ",
            "type": "separator",
          },
          Object {
            "content": Array [
              Object {
                "content": Array [
                  " Blue Raja    ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Geoffrey Smith",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Master of cutlery",
                ],
                "name": "cell",
                "type": "block",
              },
            ],
            "name": "row",
            "type": "block",
          },
          Object {
            "text": "
    ",
            "type": "separator",
          },
          Object {
            "content": Array [
              Object {
                "content": Array [
                  " Mr Furious                 ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Roy Orson                    ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Ticking time bomb of fury",
                ],
                "name": "cell",
                "type": "block",
              },
            ],
            "name": "row",
            "type": "block",
          },
          Object {
            "text": "
    ",
            "type": "separator",
          },
          Object {
            "content": Array [
              Object {
                "content": Array [
                  " The Bowler   ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Carol Pinnsler",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Haunted bowling ball",
                ],
                "name": "cell",
                "type": "block",
              },
            ],
            "name": "row",
            "type": "block",
          },
          Object {
            "text": "
    ",
            "type": "separator",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 18,
            "offset": 522,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "name": "table",
        "text": "=begin table

                            Secret
            Superhero       Identity          Superpower
            =============   ===============   ===================
            The Shoveller   Eddie Stevens     King Arthur's
                                              singing shovel

            Blue Raja       Geoffrey Smith    Master of cutlery

            Mr Furious      Roy Orson         Ticking time bomb
                                              of fury

            The Bowler      Carol Pinnsler    Haunted bowling ball

    =end table
    ",
        "type": "block",
      },
      Object {
        "type": "blankline",
      },
    ]
  `)
})

it('spec: 07-tables 6', () => {
  const pod = `
=table
    X | O |
   ---+---+---
      | X | O
   ---+---+---
      |   | X

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
                  " X",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " O",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " ",
                ],
                "name": "cell",
                "type": "block",
              },
            ],
            "name": "row",
            "type": "block",
          },
          Object {
            "text": "   ---+---+---
    ",
            "type": "separator",
          },
          Object {
            "content": Array [
              Object {
                "content": Array [
                  "  ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " X",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " O",
                ],
                "name": "cell",
                "type": "block",
              },
            ],
            "name": "row",
            "type": "block",
          },
          Object {
            "text": "   ---+---+---
    ",
            "type": "separator",
          },
          Object {
            "content": Array [
              Object {
                "content": Array [
                  "  ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  "  ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " X",
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
            "line": 8,
            "offset": 78,
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
  `)
})

it('spec: 07-tables 7', () => {
  const pod = `
=begin table :caption<foo> :bar(0)
=            :baz(2.3)

foo
bar

=end table

`
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 })
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "config": Array [
          Object {
            "name": "caption",
            "type": "string",
            "value": "foo",
          },
          Object {
            "name": "bar",
            "type": "value",
            "value": 0,
          },
          Object {
            "name": "baz",
            "type": "value",
            "value": 2.3,
          },
        ],
        "content": Array [
          Object {
            "content": Array [
              Object {
                "content": Array [
                  " foo",
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
                  " bar",
                ],
                "name": "cell",
                "type": "block",
              },
            ],
            "name": "row",
            "type": "block",
          },
          Object {
            "text": "
    ",
            "type": "separator",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 9,
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
        "text": "=begin table :caption<foo> :bar(0)
    =            :baz(2.3)

    foo
    bar

    =end table
    ",
        "type": "block",
      },
      Object {
        "type": "blankline",
      },
    ]
  `)
})

it('spec: extra', () => {
  const pod = `
    =begin table :nested

    Block typename      Specifies
    ______________      ___________________________________________________
    code                Verbatim pre-formatted sample source code
    comment             Content to be ignored by all renderers
    defn                Definition of a term
    Typename            User-defined block

=end table
  
  `
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 })
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "config": Array [
          Object {
            "name": "nested",
            "type": "boolean",
            "value": true,
          },
        ],
        "content": Array [
          Object {
            "config": Array [
              Object {
                "name": "header",
                "type": "boolean",
                "value": true,
              },
            ],
            "content": Array [
              Object {
                "content": Array [
                  " Block typename",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Specifies",
                ],
                "name": "cell",
                "type": "block",
              },
            ],
            "name": "row",
            "type": "block",
          },
          Object {
            "text": "    ______________      ___________________________________________________
    ",
            "type": "separator",
          },
          Object {
            "content": Array [
              Object {
                "content": Array [
                  " code          ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Verbatim pre-formatted sample source code",
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
                  " comment       ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Content to be ignored by all renderers",
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
                  " defn          ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Definition of a term",
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
                  " Typename      ",
                ],
                "name": "cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " User-defined block",
                ],
                "name": "cell",
                "type": "block",
              },
            ],
            "name": "row",
            "type": "block",
          },
          Object {
            "text": "
    ",
            "type": "separator",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 12,
            "offset": 366,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "    ",
        "name": "table",
        "text": "    =begin table :nested

        Block typename      Specifies
        ______________      ___________________________________________________
        code                Verbatim pre-formatted sample source code
        comment             Content to be ignored by all renderers
        defn                Definition of a term
        Typename            User-defined block

    =end table
    ",
        "type": "block",
      },
      Object {
        "type": "blankline",
      },
      Object {
        "content": Array [
          "  ",
        ],
        "location": Object {
          "end": Object {
            "column": 3,
            "line": 13,
            "offset": 371,
          },
          "start": Object {
            "column": 1,
            "line": 13,
            "offset": 369,
          },
        },
        "margin": "",
        "text": "  ",
        "type": "para",
      },
    ]
  `)
})
