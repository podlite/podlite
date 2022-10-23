import {
  isValidateError,
  PodliteDocument,
  validateAstTree,
} from "@podlite/schema";
import { md2ast } from "../src/tools";
import { frozenIds, podlite as podlite_core, PodliteExport } from "podlite";
import { PluginRegister } from "../src";
import React from "react";
import ReactDOM from "react-dom";
import { makeTestPodlite } from "@podlite/to-jsx";

const Podlite = makeTestPodlite(
  podlite_core({ importPlugins: false }).use({
    ...PluginRegister,
  })
);

const root = document.body.appendChild(document.createElement("div"));

function render(jsx) {
  return ReactDOM.render(jsx, root);
}

afterEach(() => ReactDOM.unmountComponentAtNode(root));

import { toTree, toHtml } from "pod6";
const process = (src) => {
  return md2ast(src);
};
export const parse = (str: string): PodliteDocument => {
  let podlite = podlite_core({ importPlugins: false }).use({
    ...PluginRegister,
  });
  let tree = podlite.parse(str);
  const asAst = podlite.toAstResult(tree);
  return frozenIds()(asAst.interator);
};

it("=Markdown: check line offset", () => {
  const pod = `
=para test
=Markdown
header1
`;
  const tree = parse(pod);
  //   console.log(JSON.stringify(tree, null, 2));
  const r = validateAstTree([tree]);
  expect(r).toEqual([]);
  const errorDescribe = isValidateError(r, tree);
  expect(parse(pod)).toMatchInlineSnapshot(`
    Object {
      "content": Array [
        Object {
          "type": "blankline",
        },
        Object {
          "content": Array [
            Object {
              "content": Array [
                Object {
                  "type": "text",
                  "value": "test
    ",
                },
              ],
              "location": Object {
                "end": Object {
                  "column": 1,
                  "line": 3,
                  "offset": 12,
                },
                "start": Object {
                  "column": 1,
                  "line": 2,
                  "offset": 1,
                },
              },
              "margin": "",
              "text": "test
    ",
              "type": "para",
            },
          ],
          "id": "id",
          "location": Object {
            "end": Object {
              "column": 1,
              "line": 3,
              "offset": 12,
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
          "config": Array [],
          "content": Object {
            "content": Array [
              Object {
                "content": Array [
                  "header1",
                ],
                "id": "id",
                "location": Object {
                  "end": Object {
                    "column": 8,
                    "line": 4,
                    "offset": 7,
                  },
                  "start": Object {
                    "column": 1,
                    "line": 4,
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
          },
          "id": "id",
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
          "name": "Markdown",
          "type": "block",
        },
      ],
      "id": "id",
      "margin": "",
      "name": "root",
      "type": "block",
    }
  `);
});

it("=Markdown: jsx", () => {
  const pod = `
  =para test
      =begin Markdown
      header1
      =head1 **ss**
      ddd
      =end Markdown
    `;
  render(<Podlite>{pod}</Podlite>);
  expect(root.innerHTML).toMatchInlineSnapshot(`
    <div id="id">
      <p>
        test
      </p>
    </div>
    <p id="id">
      header1
    =head1
      <strong>
        ss
      </strong>
      ddd
    </p>
    <p>
    </p>
  `);
});

it("=Markdown: check 'delete' line element", () => {
  const pod = `
=begin Markdown
asd ~~asdsd~~
=end Markdown
  `;
  render(<Podlite>{pod}</Podlite>);
  expect(root.innerHTML).toMatchInlineSnapshot(`
    <p id="id">
      asd
      <del>
        asdsd
      </del>
    </p>
    <p>
    </p>
  `);
});
