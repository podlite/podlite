// import  * as Image  from '../src';
import {
  AstTree,
  getFromTree,
  isValidateError,
  PodliteDocument,
  validateAst,
  validateAstTree,
  validatePodliteAst,
} from "@podlite/schema";
import { frozenIds, podlite as podlite_core } from "podlite";
import Image from "../src/index";

const parse = (str: string): PodliteDocument => {
  let podlite = podlite_core({ importPlugins: false }).use({ Image });
  let tree = podlite.parse(str);
  const asAst = podlite.toAst(tree);
  return asAst;
};

const parseToHtml = (str: string): string => {
  let podlite = podlite_core({ importPlugins: false }).use({ Image });
  let tree = podlite.parse(str);
  const asAst = podlite.toAst(tree);
  return podlite.toHtml(frozenIds()(asAst)).toString();
};

const cleanHTML = (html: string) => {
  return html.replace(/\n+/g, "");
};

it("AST validate", () => {
  const p = parse(`=Image test.png
    short caption`);
  const Image = getFromTree(p, "Image")[0];
  const r = validateAstTree([Image]);
  expect(r).toEqual([]);
});
it("=Image minimal", () => {
  const pod = `=for Image 
test`;
  const html = parseToHtml(pod);
  expect(html).toMatchInlineSnapshot(`
    <div class="image_block"
         id="id"
    >
      <img src="test"
           alt="undefined"
      >
    </div>
  `);
});

it("Image", () => {
  const pod = `=for Image :id<111> :alt('testAlt') :caption('testCaption') :link('testLink')
test.png
`;
  const html = parseToHtml(pod);
  expect(html).toMatchInlineSnapshot(`
    <div class="image_block"
         id="111"
    >
      <a href="testLink">
        <img src="test.png"
             alt="testAlt"
        >
      </a>
      <div class="caption">
        <p>
          testCaption
        </p>
      </div>
    </div>
  `);
});
