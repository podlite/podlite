import { getFromTree, PodliteDocument, podlitePluggable } from '@podlite/schema';
export const parse = (str: string): PodliteDocument => {
  let podlite =  podlitePluggable();
  let tree = podlite.parse(str);
  const asAst = podlite.toAstResult(tree);
  return asAst.interator;
};
export const getSuggestionContextForLine = (
  pod: string,
  line: number,
): 'pod6' | 'md' => {
  const tree = parse(pod);
  const markdownBlocks = getFromTree(tree, 'Markdown') as any; // TODO: remove `any`
  const isMd =
    markdownBlocks.findIndex(
      ({
        location: {
          start: { line: lineStart },
          end: { line: lineEnd },
        },
      }) => {
        return line > lineStart && line < lineEnd;
      },
    ) !== -1;
  if (isMd) return 'md';
  return 'pod6';
};

interface Pos {
  line: number;
  offset: number;
}
interface Selection {
  start: Pos;
  end: Pos;
  text?: string; // return result pod, after remove {}
}
export const templateGetSelectionPos = (pod: string): Selection | null => {
  // if empty selection
  const EMPTY_SELECTION = new RegExp(/\{\}/);
  const lineNumEmptySel = pod
    .split('\n')
    .findIndex((str) => str.match(EMPTY_SELECTION));
  if (lineNumEmptySel > -1) {
    const line = pod.split('\n')[lineNumEmptySel];
    const matchResult = line.match(EMPTY_SELECTION)!;
    const start = { line: lineNumEmptySel, offset: matchResult.index! };
    const end = { line: lineNumEmptySel, offset: matchResult.index! };
    return { start, end, text: pod.replace(EMPTY_SELECTION, '') };
  }
  const SELECTION = new RegExp(/\{[^}]+\}/);
  const lineNum = pod.split('\n').findIndex((str) => str.match(SELECTION));
  if (lineNum > -1) {
    const line = pod.split('\n')[lineNum];
    const matchResult = line.match(SELECTION)!;
    const start = { line: lineNum, offset: matchResult.index! };
    const end = {
      line: lineNum,
      offset: matchResult.index! + matchResult[0].length,
    };
    return { start, end, text: pod };
  }
  return null;
};

export const addVMargin = (count: number, pod: string) => {
  const addString = ' '.repeat(count);
  const [firstLine, ...restLines] = pod.split('\n');
  return [
    firstLine,
    ...[].concat(restLines).map((str) => `${addString}${str}`),
  ].join('\n');
};
