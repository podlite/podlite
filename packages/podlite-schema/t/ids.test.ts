import { getFromTree, getNodeId, mkRootBlock, PodliteDocument, toTree, validatePodliteAst } from "@podlite/schema";
import middleware from "../../core/src/ids"

export const parse = (text:string, opt?): PodliteDocument => {
    const rawTree = toTree().use(middleware).parse(text, opt={skipChain: 0, podMode: 1})
    const root = mkRootBlock({margin:""}, rawTree)
    return root; 
  };
  const pod=`=begin
  =for para :id<test>
      test
  =end`
  
  it("[ID] validate", () => {
    const p = parse(pod);
    const r = validatePodliteAst(p);
    expect(r).toEqual([]);
  });

  it("[ID] custom id", () => {
    const p = parse(pod);
    const para = getFromTree(p, "para")[0];
    const id = getNodeId(para,{})
    expect(id).toEqual("test");
  });
  
  it("[ID] validate =item", () => {
    const p = parse(`=item1 test`);
    const r = validatePodliteAst(p);
    expect(r).toEqual([]);
  });
