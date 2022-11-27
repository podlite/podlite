import { frozenIds, podlite as podlite_core } from 'podlite';
import { PodliteDocument } from '@podlite/schema';
import {
  addVMargin,
  getSuggestionContextForLine,
  templateGetSelectionPos,
} from '../src/helpers';

export const parse = (str: string): PodliteDocument => {
  let podlite = podlite_core({ importPlugins: false });
  let tree = podlite.parse(str);
  const asAst = podlite.toAstResult(tree);
  return frozenIds()(asAst.interator);
};

const pod = `
  =para test
  =Markdown
  header1
=para text
=begin Markdown
new text
=end Markdown

  `;
it('Check suggestion context: pod6', () => {
  expect(getSuggestionContextForLine(pod, 1)).toEqual('pod6');
});
it('Check suggestion context: md', () => {
  expect(getSuggestionContextForLine(pod, 4)).toEqual('md');
});
it('Check suggestion context: md second block', () => {
  expect(getSuggestionContextForLine(pod, 7)).toEqual('md');
});

it('Selection position', () => {
  const pod = `=begin pod
{test}
=end pod
`;
  const { text, ...pos } = templateGetSelectionPos(pod) || {};
  expect(pos).toEqual({
    start: { line: 1, offset: 0 },
    end: { line: 1, offset: 6 },
  });
});

it('Selection empty position 1', () => {
  const pod = `=begin pod
{test
=end pod
`;
  const pos = templateGetSelectionPos(pod);
  expect(pos).toBeNull;
});

it('Selection empty position 2', () => {
  const pod = `=begin pod
{}test
=end pod
`;
  const { start, end } = templateGetSelectionPos(pod) || {};
  expect({ start, end }).toEqual({
    start: { line: 1, offset: 0 },
    end: { line: 1, offset: 0 },
  });
});

it('Test addVMargin 4', () => {
  const pod = `=begin pod
test
=end pod`;
  const pod2 = `=begin pod
    test
    =end pod`;
  const vpod = addVMargin(4, pod);
  expect(vpod).toEqual(pod2);
});

it('Test addVMargin 0', () => {
  const pod = `=begin pod
test
=end pod`;
  const vpod = addVMargin(0, pod);
  expect(vpod).toEqual(pod);
});
