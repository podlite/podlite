import {
  PodliteDocument,
  validatePodliteAst,
} from "@podlite/schema";
import { podlite as podlite_core } from "podlite";
import { plugin } from "../src/index";
import ReactDOM from "react-dom";

export const parse = (str: string): PodliteDocument => {
  let podlite = podlite_core({ importPlugins: false }).use({
    Toc: plugin,
  });
  let tree = podlite.parse(str);
  const asAst = podlite.toAstResult(tree);
  return asAst.interator;
};

const parseToHtml = (str: string): string => {
  let podlite = podlite_core({ importPlugins: false }).use({
    Toc: plugin,
  });
  let tree = podlite.parse(str);
  const asAst = podlite.toAst(tree);
//   console.log(JSON.stringify(asAst, null, 2));
  return podlite.toHtml(asAst).toString();
};

const cleanHTML = (html: string) => {
  return html.replace(/\n+/g, "");
};

const root = document.body.appendChild(document.createElement("div"));

function render(jsx) {
  return ReactDOM.render(jsx, root);
}

// afterEach(() => ReactDOM.unmountComponentAtNode(root));

const pod = `
=begin pod
=Toc head1 head3 item item2
=head2 test2
=end pod`;
// =head1 test1 I<test> L<ddd | test >

it("=Toc: toAst", () => {
  const p = parse(pod);
  // try to validate Formal AST
    // console.log(JSON.stringify(p,null,2))
  const r = validatePodliteAst(p);
  expect(r).toEqual([]);
});

// it("=Diagram: Error handle", () => {
//   const p = parse(
//     `=Diagram
// graph EROROROOROR
// A --- B
// B-->C[fa:fa-ban forbidden]
// B-->D(fa:fa-spinner aaaaa);
// `
//   );

//   const diagram = getFromTree(p, "Diagram")[0];
//   //  console.log(JSON.stringify(diagram, null,2))
//   expect("custom" in diagram).toBeTruthy();
// });

it("=Toc: parse to html", () => {
  const pod = `=Toc head1 head3 item item2`;
  expect(parseToHtml(pod)).toMatchInlineSnapshot(`
    <h1>
      Table of contents
    </h1>
  `);
});

it("=Toc: head1 head2", () => {
  const pod = `=Toc head1 head2
=for head1 :id<123>
Test head1
`;
// console.log(JSON.stringify(parse(pod), null, 2));
// console.log(parseToHtml(pod));
//   expect(parseToHtml(pod)).toMatchInlineSnapshot();
});
it("=Toc: head1 head2 item", () => {
    const pod = `=Toc head1 head2 head3 item item2 
  =for head1 :id<123>
  head1
  =head2 head2
  =item1 test
  =item2 test2
  =item1 item1
  =head3 head3
  =item1 item1
  
  `;
  // console.log(JSON.stringify(parse(pod), null, 2));
//   console.log(parseToHtml(pod));
  //   expect(parseToHtml(pod)).toMatchInlineSnapshot();
  });
  