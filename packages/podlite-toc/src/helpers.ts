import { makeTransformer, getNodeId, getTextContentFromNode } from "@podlite/schema"

export const prepareDataForToc = (data: any[]) => {

    const isSemanticBlock = ( node ) => { 
      const name = node.name || ''
      const isTypeBlock = ( node.type || '') === 'block'
      return isTypeBlock && name === name.toUpperCase()
      }
   const reduceLevel = (arr) =>{
       return arr.reduce((i,c)=>{
          return (i.includes(c) ? [...i] : [...i,c]).sort((a,b)=>a-b)
       },[])
  
   }
    const normalizeLevels = (data) => {
        const namesLevels = {}
       for ( const node of data ) {
          if ( isSemanticBlock(node) ) {
              const level = 1
              node.level = level
              namesLevels['head'] = reduceLevel([ ...(namesLevels['head'] || []) ,1 ])
              
          } else {
              // TODO: eliminate string level (=item)
              // default level is 1 for all items
              namesLevels[node.name] = reduceLevel([...(namesLevels[node.name] || []), parseInt(node.level,10) || 1 ])
          }
      }
      return namesLevels
    }
    const levelsMap = normalizeLevels(data)
    const tocTree = [
        [ -1, { item: 'toc', level:0 ,  node:{} } ]
    ];
    /**
      // find nearest by level
      const tocTree = [
          [ -1, { item: 'toc', level:0 } ],
          [ 0, { item: 'head', level:1 } ],
          [ 1, { item: 'head2', level:2 } ],
          [ 0, { item: 'head', level:1 } ],
          [ 3, { item: 'item2', level:3 } ],
      ];
      const sq = getIndexByLevel(tocTree, 4)
    */
    const getRootIndexByLevel = (tocTree, level) => {
      return tocTree.length - tocTree.slice().reverse().findIndex(e => e[1].level < level) -1
   }
    let currentLevel = 1
    // prepare normilized data
    for (let i = 0; i < data.length; i++) {
      const item = data[i]
      // deafult level is 1 for all items
      const normalizedLevel:number = levelsMap[item.name].findIndex(l => l === parseInt(item.level || 1)) +1
      switch (item.name) {
          case 'head': {
            const parent = getRootIndexByLevel(tocTree, normalizedLevel)
            tocTree.push([parent, {item:item.name,level:normalizedLevel, node:item }])
            if (currentLevel != normalizedLevel) {
                 currentLevel = normalizedLevel
            }
          }
          break;
          default: {
            const newlevel = currentLevel + normalizedLevel
            const parent = getRootIndexByLevel(tocTree, newlevel)
            tocTree.push([parent, {item:item.name, level:newlevel, node:item }])
          }
          break;
      }
    }
      //Turns given flat arr into a tree and returns root..
      //(Assumes that no child is declared before parent)
      function makeTree(arr){
          //Array with all the children elements set correctly..
          var treeArr = new Array(arr.length);
  
          for(var i = 0, len = arr.length; i < len; i++){
              var arrI = arr[i];
              var newNode = treeArr[i] = {
                  type: arrI[1].item,
                  level: arrI[1].level,
                  node: arrI[1].node,
                  content: []
              };
              var parentI = arrI[0];
              if(parentI > -1){ //i.e. not the root..
                  treeArr[parentI].content.push(newNode);
              }
          }
          return treeArr[0]; //return the root..
      }
    return makeTree(tocTree)
  }  

 export const getTocPod = (tocTree: any, tocTitle = "Table of contents"):string => {
    let blocks = []
    const rules = {
        ":toc": (node,_, visiter)=>{
         blocks.push(`=head1 ${tocTitle}`)
         visiter(node.content)
        },
        ":head": (node,ctx, visiter)=>{
             const id = getNodeId(node.node, ctx)
             blocks.push(`=item${node.level} L<${getTextContentFromNode(node.node).trim()} ${id ? `|#${id}`:''}>`)
             visiter(node.content)
        },
        ":item": (node,_, visiter)=>{
         blocks.push(`=item${node.level} ${getTextContentFromNode(node.node).trim()}`)
         visiter(node.content)
         },
     }
    const transformer = makeTransformer(rules)
    const res = transformer(tocTree, {})
    return blocks.join('\n')
 }
 
