import { isValidateError } from "@podlite/schema";
import { validateAstTree } from "@podlite/schema";
import { validateAst } from "@podlite/schema";
import { frozenIds } from "podlite/src";
import { md2ast } from "../src/tools";
import { podlite as podlite_core } from "podlite";
import { PodliteDocument } from "@podlite/schema";

const process = (src) => {
  return frozenIds()(md2ast(src));
};
const process1 = (src) => {
  return frozenIds()(md2ast(src));
};

export const parse = (str: string): PodliteDocument => {
  let podlite = podlite_core({ importPlugins: false }).use({
    //   Toc: plugin,
  });
  let tree = podlite.parse(str);
  const asAst = podlite.toAstResult(tree);
  return asAst.interator;
};
it("=Markdown: parse para", () => {
  const pod = `text`;
  //   const tree1 = parse(pod);
  const tree = process(pod);
  // console.log(JSON.stringify(tree, null, 2));
  // console.log(JSON.stringify(tree1, null, 2));
  const r = validateAstTree([tree]);
  expect(r).toEqual([]);
  const errorDescribe = isValidateError(r, tree);
  expect(process(pod)).toMatchInlineSnapshot(`
    Object {
      "content": Array [
        Object {
          "content": Array [
            "text",
          ],
          "id": "id",
          "location": Object {
            "end": Object {
              "column": 5,
              "line": 1,
              "offset": 4,
            },
            "start": Object {
              "column": 1,
              "line": 1,
              "offset": 0,
            },
          },
          "margin": "",
          "text": "text",
          "type": "para",
        },
      ],
      "id": "id",
      "margin": "",
      "name": "root",
      "type": "block",
    }
  `);
});

it.skip("[markdown]: parse para", () => {
  const pod = `text`;
  //   const tree1 = parse(pod);
  const tree = process(pod);
  // console.log(JSON.stringify(tree, null, 2));
  // console.log(JSON.stringify(tree1, null, 2));
  const r = validateAstTree([tree]);
  expect(r).toEqual([]);
  const errorDescribe = isValidateError(r, tree);
  //   expect(process(pod)).toMatchInlineSnapshot();
});

it("[markdown]: parse headers", () => {
  const pod = `## build

Generate JavaScript documentation as a list of parsed JSDoc
comments, given a root file as a path`;
  const tree = process(pod);
  const r = validateAstTree([tree]);
  expect(r).toEqual([]);
  const errorDescribe = isValidateError(r, tree);
  expect(process(pod)).toMatchInlineSnapshot(`
    Object {
      "content": Array [
        Object {
          "content": Array [
            "build",
          ],
          "id": "id",
          "level": 2,
          "location": Object {
            "end": Object {
              "column": 9,
              "line": 1,
              "offset": 8,
            },
            "start": Object {
              "column": 1,
              "line": 1,
              "offset": 0,
            },
          },
          "margin": "",
          "name": "head",
          "type": "block",
        },
        Object {
          "content": Array [
            "Generate JavaScript documentation as a list of parsed JSDoc
    comments, given a root file as a path",
          ],
          "id": "id",
          "location": Object {
            "end": Object {
              "column": 38,
              "line": 4,
              "offset": 107,
            },
            "start": Object {
              "column": 1,
              "line": 3,
              "offset": 10,
            },
          },
          "margin": "",
          "text": "text",
          "type": "para",
        },
      ],
      "id": "id",
      "margin": "",
      "name": "root",
      "type": "block",
    }
  `);
});
it("[markdown]: parse link", () => {
  const pod = `[#raku IRC channel](https://raku.org/community/irc)`;
  const tree = process(pod);
  const r = validateAstTree([tree]);
  expect(r).toEqual([]);
  const errorDescribe = isValidateError(r, tree);
  expect(process(pod)).toMatchInlineSnapshot(`
    Object {
      "content": Array [
        Object {
          "content": Array [
            Object {
              "content": Array [
                "#raku IRC channel",
              ],
              "location": Object {
                "end": Object {
                  "column": 52,
                  "line": 1,
                  "offset": 51,
                },
                "start": Object {
                  "column": 1,
                  "line": 1,
                  "offset": 0,
                },
              },
              "meta": "https://raku.org/community/irc",
              "name": "L",
              "type": "fcode",
            },
          ],
          "id": "id",
          "location": Object {
            "end": Object {
              "column": 52,
              "line": 1,
              "offset": 51,
            },
            "start": Object {
              "column": 1,
              "line": 1,
              "offset": 0,
            },
          },
          "margin": "",
          "text": "text",
          "type": "para",
        },
      ],
      "id": "id",
      "margin": "",
      "name": "root",
      "type": "block",
    }
  `);
});
it("[markdown]: parse image", () => {
  const pod = `![foo](/url "title")`;
  const tree = process(pod);
  console.log(JSON.stringify(tree, null, 2));
  const r = validateAstTree([tree]);
  expect(r).toEqual([]);
  const errorDescribe = isValidateError(r, tree);
  expect(process(pod)).toMatchInlineSnapshot(`
    Object {
      "content": Array [
        Object {
          "content": Array [
            Object {
              "config": Array [],
              "content": Array [
                Object {
                  "alt": "foo",
                  "src": "/url",
                  "type": "image",
                },
                Object {
                  "content": Array [
                    "title",
                  ],
                  "name": "caption",
                  "type": "block",
                },
              ],
              "id": "id",
              "location": Object {
                "end": Object {
                  "column": 21,
                  "line": 1,
                  "offset": 20,
                },
                "start": Object {
                  "column": 1,
                  "line": 1,
                  "offset": 0,
                },
              },
              "margin": "",
              "name": "Image",
              "type": "block",
            },
          ],
          "id": "id",
          "location": Object {
            "end": Object {
              "column": 21,
              "line": 1,
              "offset": 20,
            },
            "start": Object {
              "column": 1,
              "line": 1,
              "offset": 0,
            },
          },
          "margin": "",
          "text": "text",
          "type": "para",
        },
      ],
      "id": "id",
      "margin": "",
      "name": "root",
      "type": "block",
    }
  `);
});

it("[markdown]: parse refs", () => {
    const pod = `### Table of Contents

-   [lint][1]
    -   [Parameters][2]


[1]: #lint

[2]: #parameters`;
    //   const tree1 = parse(pod);
    const tree = process(pod);
    console.log(JSON.stringify(tree, null, 2));
    // console.log(JSON.stringify(tree1, null, 2));
    const r = validateAstTree([tree]);
    expect(r).toEqual([]);
    const errorDescribe = isValidateError(r, tree);
    //   expect(process(pod)).toMatchInlineSnapshot();
  });
