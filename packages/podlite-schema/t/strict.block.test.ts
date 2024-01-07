var parse = require("..").parse;
describe("strict block names ", () => {
  const t1 = `=begin one
    s dddd
=end one
`;
  it("delimited podMode:0", () => {
    const tree = parse(t1, { podMode: 0 });
    expect(tree).toMatchInlineSnapshot(`
      Array [
        Object {
          "location": Object {
            "end": Object {
              "column": 1,
              "line": 4,
              "offset": 31,
            },
            "start": Object {
              "column": 1,
              "line": 1,
              "offset": 0,
            },
          },
          "text": "=begin one
          s dddd
      =end one
      ",
          "type": "ambient",
        },
      ]
    `);
  });

  it("delimited podMode:1", () => {
    const tree = parse(t1, { podMode: 1 });
    expect(tree).toMatchInlineSnapshot(`
      Array [
        Object {
          "content": Array [
            "=begin one
          s dddd
      =end one
      ",
          ],
          "location": Object {
            "end": Object {
              "column": 1,
              "line": 4,
              "offset": 31,
            },
            "start": Object {
              "column": 1,
              "line": 1,
              "offset": 0,
            },
          },
          "margin": "",
          "text": "=begin one
          s dddd
      =end one
      ",
          "type": "para",
        },
      ]
    `);
  });

  const t2 = `=for one
test
`;
  it("paragraphBlock podMode:1", () => {
    const tree = parse(t2, { podMode: 1 });
    expect(tree).toMatchInlineSnapshot(`
      Array [
        Object {
          "content": Array [
            "=for one
      test
      ",
          ],
          "location": Object {
            "end": Object {
              "column": 1,
              "line": 3,
              "offset": 14,
            },
            "start": Object {
              "column": 1,
              "line": 1,
              "offset": 0,
            },
          },
          "margin": "",
          "text": "=for one
      test
      ",
          "type": "para",
        },
      ]
    `);
  });

  it("paragraphBlock podMode:0", () => {
    const tree = parse(t2, { podMode: 0 });
    // console.log(toStr(tree))
    expect(tree).toMatchInlineSnapshot(`
      Array [
        Object {
          "location": Object {
            "end": Object {
              "column": 1,
              "line": 3,
              "offset": 14,
            },
            "start": Object {
              "column": 1,
              "line": 1,
              "offset": 0,
            },
          },
          "text": "=for one
      test
      ",
          "type": "ambient",
        },
      ]
    `);
  });

  const t3 = `=one
test
`;

  it("abbreviatedBlock podMode:0", () => {
    const tree = parse(t3, { podMode: 0 });
    expect(tree).toMatchInlineSnapshot(`
      Array [
        Object {
          "location": Object {
            "end": Object {
              "column": 1,
              "line": 3,
              "offset": 10,
            },
            "start": Object {
              "column": 1,
              "line": 1,
              "offset": 0,
            },
          },
          "text": "=one
      test
      ",
          "type": "ambient",
        },
      ]
    `);
  });

  it("abbreviatedBlock podMode:1", () => {
    const tree = parse(t3, { podMode: 1 });
    expect(tree).toMatchInlineSnapshot(`
      Array [
        Object {
          "content": Array [
            "=one
      test
      ",
          ],
          "location": Object {
            "end": Object {
              "column": 1,
              "line": 3,
              "offset": 10,
            },
            "start": Object {
              "column": 1,
              "line": 1,
              "offset": 0,
            },
          },
          "margin": "",
          "text": "=one
      test
      ",
          "type": "para",
        },
      ]
    `);
  });

  it("Named blok + margin podMode:1", () => {
    const tree = parse(
      `
        =begin Test
        s B<ssss>
        =end some
         d
        =end Test
=para sss`,
      { podMode: 1, skipChain: 1 }
    );
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
              "value": "s B<ssss>
      =end some
       d
      ",
            },
          ],
          "location": Object {
            "end": Object {
              "column": 1,
              "line": 7,
              "offset": 86,
            },
            "start": Object {
              "column": 1,
              "line": 2,
              "offset": 1,
            },
          },
          "margin": "        ",
          "name": "Test",
          "text": "        =begin Test
              s B<ssss>
              =end some
               d
              =end Test
      ",
          "type": "block",
        },
        Object {
          "content": Array [
            Object {
              "content": Array [
                Object {
                  "type": "text",
                  "value": "sss",
                },
              ],
              "location": Object {
                "end": Object {
                  "column": 10,
                  "line": 7,
                  "offset": 95,
                },
                "start": Object {
                  "column": 1,
                  "line": 7,
                  "offset": 86,
                },
              },
              "margin": "",
              "text": "sss",
              "type": "para",
            },
          ],
          "location": Object {
            "end": Object {
              "column": 10,
              "line": 7,
              "offset": 95,
            },
            "start": Object {
              "column": 1,
              "line": 7,
              "offset": 86,
            },
          },
          "margin": "",
          "name": "para",
          "type": "block",
        },
      ]
    `);
  });
});
