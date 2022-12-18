import {
  PodliteDocument,
  validatePodliteAst,
  getFromTree,
} from '@podlite/schema';
import { podlite as podlite_core } from 'podlite';
import Diagram, { plugin as DiagramPlugin } from '../src/index';
import { TestPodlite as Podlite } from '@podlite/to-jsx';
import React from 'react';
import ReactDOM from 'react-dom';
import makeAttrs from 'pod6/built/helpers/config';

const parse = (str: string): PodliteDocument => {
  let podlite = podlite_core({ importPlugins: false }).use({
    Diagram: DiagramPlugin,
  });
  let tree = podlite.parse(str);
  const asAst = podlite.toAstResult(tree);
  return asAst.interator;
};

const parseToHtml = (str: string): string => {
  let podlite = podlite_core({ importPlugins: false }).use({
    Diagram: DiagramPlugin,
  });
  let tree = podlite.parse(str);
  const asAst = podlite.toAst(tree);
  return podlite.toHtml(asAst).toString();
};

const cleanHTML = (html: string) => {
  return html.replace(/\n+/g, '');
};

const plugins = (makeComponent) => {
  return {
    Diagram: () => (node, ctx, interator) => {
      const conf = makeAttrs(node, ctx);
      const caption = conf.exists('caption')
        ? conf.getFirstValue('caption')
        : null;
      return makeComponent(
        ({ children, key }) => {
          return (
            <Diagram
              isError={node.custom}
              key={key}
              caption={caption}
              chart={node.content[0].value}
            />
          );
        },
        node,
        interator(node.content, { ...ctx }),
      );
    },
  };
};

const root = document.body.appendChild(document.createElement('div'));

function render(jsx) {
  return ReactDOM.render(jsx, root);
}

// afterEach(() => ReactDOM.unmountComponentAtNode(root));

const pod = `
=begin pod
=Diagram
graph LR
A --- B
B-->C[fa:fa-ban forbidden]
B-->D(fa:fa-spinner aaaaa);
=end pod`;

it('=Diagram: toAst', () => {
  const p = parse(pod);
  // try to validate Formal AST
  const r = validatePodliteAst(p);
  expect(r).toEqual([]);
});

it('=Diagram: Error handle', () => {
  const p = parse(
    `=Diagram
graph EROROROOROR
A --- B
B-->C[fa:fa-ban forbidden]
B-->D(fa:fa-spinner aaaaa);
`,
  );

  const diagram = getFromTree(p, 'Diagram')[0];
  expect('custom' in diagram).toBeTruthy();
});

it('=Diagrams: parse to html', () => {
  expect(parseToHtml(pod)).toMatchInlineSnapshot(`""`);
});
it('=Diagrams: caption', () => {
  const pod = `
=begin Diagram :caption('Caption test')
    graph LR
            A-->B
            B-->C
            C-->A
            D-->C
=end Diagram
`;
  render(<Podlite plugins={plugins}>{pod}</Podlite>);
  expect(root.innerHTML).toMatchInlineSnapshot(`
    <div class="diagram"
         id="id"
    >
      <div class="mermaid">
      </div>
      <div class="caption">
        Caption test
      </div>
    </div>
  `);
});

it('accepts =Diagram', () => {
  render(<Podlite plugins={plugins}>{pod}</Podlite>);
  expect(root.innerHTML).toMatchInlineSnapshot(`
    <div id="id">
      <div class="diagram"
           id="id"
      >
        <div class="mermaid">
        </div>
      </div>
    </div>
  `);
});
