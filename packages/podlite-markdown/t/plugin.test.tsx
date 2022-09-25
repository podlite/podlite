import {
  getFromTree,
  PodliteDocument,
  validatePodliteAst,
} from "@podlite/schema";
import { podlite as podlite_core } from "podlite";
import { plugin } from "../src/index";
import Image from "@podlite/image";
import { frozenIds } from "podlite/src";

export const parse = (str: string): PodliteDocument => {
  let podlite = podlite_core({ importPlugins: false }).use({
    Toc: plugin,
  });
  let tree = podlite.parse(str);
  const asAst = podlite.toAstResult(tree);
  return asAst.interator;
};

export const parseImage = (str: string): PodliteDocument => {
  let podlite = podlite_core({ importPlugins: false }).use({
    Toc: plugin,
    Image,
  });
  let tree = podlite.parse(str);
  const asAst = podlite.toAstResult(tree);
  return asAst.interator;
};

const parseToHtml = (str: string): string => {
  let podlite = podlite_core({ importPlugins: false }).use({
    Toc: plugin,
    Image,
  });
  let tree = podlite.parse(str);
  const asAst = podlite.toAst(frozenIds()(tree));
  return podlite.toHtml(asAst).toString();
};

const pod = `
=begin pod
=Toc head1 head3 item item2
=head2 test2
=end pod`;
// =head1 test1 I<test> L<ddd | test >

it("=Toc: toAst", () => {
  const p = parse(pod);
  // try to validate Formal AST
  const r = validatePodliteAst(p);
  expect(r).toEqual([]);
});

it("=para: parse to html", () => {
  const pod = `=para head1 head3 item item2`;
  expect(parseToHtml(pod)).toMatchInlineSnapshot(`
    <p>
      head1 head3 item item2
    </p>
  `);
});

it("=Toc: parse to html", () => {
  const pod = `=Toc head1 head3 item item2`;
  expect(parseToHtml(pod)).toMatchInlineSnapshot(`
    <div classname="toc">
      <ul class="toc-list listlevel1">
      </ul>
    </div>
  `);
});

it("=Toc: head1 head2", () => {
  const pod = `=Toc head1 head2
=for head1 :id<123>
Test head1
`;
  expect(parseToHtml(pod)).toMatchInlineSnapshot(`
    <div classname="toc">
      <ul class="toc-list listlevel1">
        <li class="toc-item">
          <p>
            <a href="#123">
              Test head1
            </a>
          </p>
        </li>
      </ul>
    </div>
    <h1 id="123">
      Test head1
    </h1>
  `);
});

it("[check default list]=Toc", () => {
  const pod = `=Toc
=head1 head
=head2 head
=head3 head
=head4 head
=head5 head
=head6 head
    `;
  expect(parseToHtml(pod)).toMatchInlineSnapshot(`
    <div classname="toc">
      <ul class="toc-list listlevel1">
        <li class="toc-item">
          <p>
            <a href="#id">
              head
            </a>
          </p>
        </li>
        <ul class="toc-list listlevel2">
          <li class="toc-item">
            <p>
              <a href="#id">
                head
              </a>
            </p>
          </li>
          <ul class="toc-list listlevel3">
            <li class="toc-item">
              <p>
                <a href="#id">
                  head
                </a>
              </p>
            </li>
            <ul class="toc-list listlevel4">
              <li class="toc-item">
                <p>
                  <a href="#id">
                    head
                  </a>
                </p>
              </li>
              <ul class="toc-list listlevel5">
                <li class="toc-item">
                  <p>
                    <a href="#id">
                      head
                    </a>
                  </p>
                </li>
                <ul class="toc-list listlevel6">
                  <li class="toc-item">
                    <p>
                      <a href="#id">
                        head
                      </a>
                    </p>
                  </li>
                </ul>
              </ul>
            </ul>
          </ul>
        </ul>
      </ul>
    </div>
    <h1 id="id">
      head
    </h1>
    <h2 id="id">
      head
    </h2>
    <h3 id="id">
      head
    </h3>
    <h4 id="id">
      head
    </h4>
    <h5 id="id">
      head
    </h5>
    <h6 id="id">
      head
    </h6>
  `);
});
it.skip("=Toc Image Diagram1", () => {
  const pod = `=for Toc :title<Table of Media>
  Image Diagram 
    =for Image :caption<Image caption> :id(1)
    https://example.com.image.png
    =Image https://example.com.image.png
    
    =for Diagram :caption<Diagram caption> :id(2)
    User content
    `;
  const nodes = getFromTree(parseImage(pod), ":image");
  console.log(JSON.stringify(nodes, null, 2));
  console.log(parseToHtml(nodes));
  // expect(parseToHtml(pod)).toMatchInlineSnapshot()
});

it("=Toc Image Diagram", () => {
  const pod = `=for Toc :title<Table of Media>
Image Diagram 
  =for Image :caption<Image caption> :id(1)
  https://example.com.image.png
  =for Diagram :caption<Diagram caption> :id(2)
  User content
  `;
  expect(parseToHtml(pod)).toMatchInlineSnapshot(`
    <div classname="toc">
      <ul class="toc-list listlevel1">
        <li class="toc-item">
          <p>
            <a href="#1">
              Image caption
            </a>
          </p>
        </li>
        <li class="toc-item">
          <p>
            <a href="#2">
              Diagram caption
            </a>
          </p>
        </li>
      </ul>
    </div>
    <div class="image_block"
         id="1"
    >
      <img src="https://example.com.image.png"
           alt="undefined"
      >
      <div class="caption">
        <p>
          Image caption
        </p>
      </div>
    </div>
  `);
});
