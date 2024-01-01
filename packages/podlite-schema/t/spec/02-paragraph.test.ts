import { toTree, toHtml } from "../..";

it("spec: 02-paragraph 0", () => {
  const pod = `
=for Foo

`;
  const tree = toTree().parse(pod, { podMode: 1, skipChain: 0 });
  expect(tree).toMatchInlineSnapshot(`
    Array [
      Object {
        "type": "blankline",
      },
      Object {
        "config": Array [],
        "content": Array [],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 3,
            "offset": 10,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "name": "Foo",
        "type": "block",
      },
      Object {
        "type": "blankline",
      },
    ]
  `);
});

it("spec: 02-paragraph 1", () => {
  const pod = `
=for Foo
some text

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
            "value": "some text
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
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "name": "Foo",
        "type": "block",
      },
      Object {
        "type": "blankline",
      },
    ]
  `);
});

it("spec: 02-paragraph 2", () => {
  const pod = `
=for Foo
some
spaced   text

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
            "value": "some
    spaced   text
    ",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 5,
            "offset": 29,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "name": "Foo",
        "type": "block",
      },
      Object {
        "type": "blankline",
      },
    ]
  `);
});

it("spec: 02-paragraph 3", () => {
  const pod = `
=begin pod

=for Got
Inside Got

   =for Bidden
   Inside Bidden

Outside blocks
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
            "type": "blankline",
          },
          Object {
            "config": Array [],
            "content": Array [
              Object {
                "type": "verbatim",
                "value": "Inside Got
    ",
              },
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 6,
                "offset": 33,
              },
              "start": Object {
                "column": 1,
                "line": 4,
                "offset": 13,
              },
            },
            "margin": "",
            "name": "Got",
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
                "value": "   Inside Bidden
    ",
              },
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 9,
                "offset": 66,
              },
              "start": Object {
                "column": 1,
                "line": 7,
                "offset": 34,
              },
            },
            "margin": "   ",
            "name": "Bidden",
            "type": "block",
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
                "offset": 82,
              },
              "start": Object {
                "column": 1,
                "line": 10,
                "offset": 67,
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
            "offset": 91,
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

it("spec: 02-paragraph 4", () => {
  const pod = `
=begin pod
=begin One
One, delimited block
=end One
=for Two
Two, paragraph block
=for Three
Three, still a parablock

=begin Four
Four, another delimited one
=end Four
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
                "value": "One, delimited block
    ",
              },
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 6,
                "offset": 53,
              },
              "start": Object {
                "column": 1,
                "line": 3,
                "offset": 12,
              },
            },
            "margin": "",
            "name": "One",
            "text": "=begin One
    One, delimited block
    =end One
    ",
            "type": "block",
          },
          Object {
            "config": Array [],
            "content": Array [
              Object {
                "type": "verbatim",
                "value": "Two, paragraph block
    ",
              },
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 8,
                "offset": 83,
              },
              "start": Object {
                "column": 1,
                "line": 6,
                "offset": 53,
              },
            },
            "margin": "",
            "name": "Two",
            "type": "block",
          },
          Object {
            "config": Array [],
            "content": Array [
              Object {
                "type": "verbatim",
                "value": "Three, still a parablock
    ",
              },
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 10,
                "offset": 119,
              },
              "start": Object {
                "column": 1,
                "line": 8,
                "offset": 83,
              },
            },
            "margin": "",
            "name": "Three",
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
                "value": "Four, another delimited one
    ",
              },
            ],
            "location": Object {
              "end": Object {
                "column": 1,
                "line": 14,
                "offset": 170,
              },
              "start": Object {
                "column": 1,
                "line": 11,
                "offset": 120,
              },
            },
            "margin": "",
            "name": "Four",
            "text": "=begin Four
    Four, another delimited one
    =end Four
    ",
            "type": "block",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 15,
            "offset": 179,
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

it("spec: 02-paragraph 5", () => {
  const pod = `
=begin Foo
and so,  all  of  the  villages chased
Albi,   The   Racist  Dragon, into the
very   cold   and  very  scary    cave

and it was so cold and so scary in
there,  that  Albi  began  to  cry

    =for Bar
    Dragon Tears!

Which, as we all know...

    =for Bar
    Turn into Jelly Beans!
=end Foo

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
            "value": "and so,  all  of  the  villages chased
    Albi,   The   Racist  Dragon, into the
    very   cold   and  very  scary    cave

    and it was so cold and so scary in
    there,  that  Albi  began  to  cry

        =for Bar
        Dragon Tears!

    Which, as we all know...

        =for Bar
        Turn into Jelly Beans!
    ",
          },
        ],
        "location": Object {
          "end": Object {
            "column": 1,
            "line": 18,
            "offset": 308,
          },
          "start": Object {
            "column": 1,
            "line": 2,
            "offset": 1,
          },
        },
        "margin": "",
        "name": "Foo",
        "text": "=begin Foo
    and so,  all  of  the  villages chased
    Albi,   The   Racist  Dragon, into the
    very   cold   and  very  scary    cave

    and it was so cold and so scary in
    there,  that  Albi  began  to  cry

        =for Bar
        Dragon Tears!

    Which, as we all know...

        =for Bar
        Turn into Jelly Beans!
    =end Foo
    ",
        "type": "block",
      },
      Object {
        "type": "blankline",
      },
    ]
  `);
});
