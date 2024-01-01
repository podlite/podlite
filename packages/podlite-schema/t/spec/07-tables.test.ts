import { toTree, toHtml } from "../..";

it("spec: 07-tables 0", () => {
  const pod = `
=begin table
        The Shoveller   Eddie Stevens     King Arthur's singing shovel
        Blue Raja       Geoffrey Smith    Master of cutlery
        Mr Furious      Roy Orson         Ticking time bomb of fury
        The Bowler      Carol Pinnsler    Haunted bowling ball
=end table

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
                "content": Array [
                  " The Shoveller",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Eddie Stevens ",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " King Arthur's singing shovel",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_row",
            "type": "block",
          },
          Object {
            "content": Array [
              Object {
                "content": Array [
                  " Blue Raja    ",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Geoffrey Smith",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Master of cutlery",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_row",
            "type": "block",
          },
          Object {
            "content": Array [
              Object {
                "content": Array [
                  " Mr Furious   ",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Roy Orson     ",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Ticking time bomb of fury",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_row",
            "type": "block",
          },
          Object {
            "content": Array [
              Object {
                "content": Array [
                  " The Bowler   ",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Carol Pinnsler",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Haunted bowling ball",
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
  `);
});

it("spec: 07-tables 1", () => {
  const pod = `
=table
    Constants           1
    Variables           10
    Subroutines         33
    Everything else     57

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
                "content": Array [
                  " Constants      ",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " 1",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_row",
            "type": "block",
          },
          Object {
            "content": Array [
              Object {
                "content": Array [
                  " Variables      ",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " 10",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_row",
            "type": "block",
          },
          Object {
            "content": Array [
              Object {
                "content": Array [
                  " Subroutines    ",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " 33",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_row",
            "type": "block",
          },
          Object {
            "content": Array [
              Object {
                "content": Array [
                  " Everything else",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " 57",
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
  `);
});

it("spec: 07-tables 2", () => {
  const pod = `
=for table
    mouse    | mice
    horse    | horses
    elephant | elephants

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
                "content": Array [
                  " mouse   ",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " mice",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_row",
            "type": "block",
          },
          Object {
            "content": Array [
              Object {
                "content": Array [
                  " horse   ",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " horses",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_row",
            "type": "block",
          },
          Object {
            "content": Array [
              Object {
                "content": Array [
                  " elephant",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " elephants",
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
  `);
});

it("spec: 07-tables 3", () => {
  const pod = `
=table
    Animal | Legs |    Eats
    =======================
    Zebra  +   4  + Cookies
    Human  +   2  +   Pizza
    Shark  +   0  +    Fish

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
                "content": Array [
                  " Animal",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Legs",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  "    Eats",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_head",
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
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  "   4 ",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Cookies",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_row",
            "type": "block",
          },
          Object {
            "content": Array [
              Object {
                "content": Array [
                  " Human ",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  "   2 ",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  "   Pizza",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_row",
            "type": "block",
          },
          Object {
            "content": Array [
              Object {
                "content": Array [
                  " Shark ",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  "   0 ",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  "    Fish",
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
  `);
});

it("spec: 07-tables 4", () => {
  const pod = `
=table
        Superhero     | Secret          |
                      | Identity        | Superpower
        ==============|=================|================================
        The Shoveller | Eddie Stevens   | King Arthur's singing shovel

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
                "content": Array [
                  " Superhero                  ",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Secret        Identity     ",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  "  Superpower",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_head",
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
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Eddie Stevens",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " King Arthur's singing shovel",
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
  `);
});

it("spec: 07-tables 5", () => {
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
                "content": Array [
                  "               Superhero    ",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Secret Identity      ",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  "  Superpower",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_head",
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
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Eddie Stevens                ",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " King Arthur's singing shovel",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_row",
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
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Geoffrey Smith",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Master of cutlery",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_row",
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
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Roy Orson                    ",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Ticking time bomb of fury",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_row",
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
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Carol Pinnsler",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Haunted bowling ball",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_row",
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
  `);
});

it("spec: 07-tables 6", () => {
  const pod = `
=table
    X | O |
   ---+---+---
      | X | O
   ---+---+---
      |   | X

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
                "content": Array [
                  " X",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " O",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " ",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_row",
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
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " X",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " O",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_row",
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
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  "  ",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " X",
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
  `);
});

it("spec: 07-tables 7", () => {
  const pod = `
=begin table :caption<foo> :bar(0)
=            :baz(2.3)

foo
bar

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
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_row",
            "type": "block",
          },
          Object {
            "content": Array [
              Object {
                "content": Array [
                  " bar",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_row",
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
  `);
});

it("spec: extra", () => {
  const pod = `
    =begin table :nested

    Block typename      Specifies
    ______________      ___________________________________________________
    code                Verbatim pre-formatted sample source code
    comment             Content to be ignored by all renderers
    defn                Definition of a term
    Typename            User-defined block

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
            "name": "nested",
            "type": "boolean",
            "value": true,
          },
        ],
        "content": Array [
          Object {
            "content": Array [
              Object {
                "content": Array [
                  " Block typename",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Specifies",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_head",
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
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Verbatim pre-formatted sample source code",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_row",
            "type": "block",
          },
          Object {
            "content": Array [
              Object {
                "content": Array [
                  " comment       ",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Content to be ignored by all renderers",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_row",
            "type": "block",
          },
          Object {
            "content": Array [
              Object {
                "content": Array [
                  " defn          ",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " Definition of a term",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_row",
            "type": "block",
          },
          Object {
            "content": Array [
              Object {
                "content": Array [
                  " Typename      ",
                ],
                "name": "table_cell",
                "type": "block",
              },
              Object {
                "content": Array [
                  " User-defined block",
                ],
                "name": "table_cell",
                "type": "block",
              },
            ],
            "name": "table_row",
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
  `);
});
