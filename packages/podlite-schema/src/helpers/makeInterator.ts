function flattenDeep(arr) {
    if (!Array.isArray(arr)) {
        return arr
    }
    return arr.reduce((acc, val) => Array.isArray(val) ? acc.concat(flattenDeep(val)) : acc.concat(val), []);
   }
function thisFunc ( rules )  {

    function interator (node, context)  {
        if (node instanceof Array) {
            // filter null and undefined nodes
            return  flattenDeep(node.map( item =>interator(item, context))).filter(Boolean)
        }
        if ( 'string' === typeof node ) {
            // convert string to lex node with type 
            return interator({type:'text', value:node}, context)
        }
        // get first rule for this node
        const reversed = rules.slice()
        reversed.reverse()
        const ruleIndex = reversed.findIndex( rule => rule.isFor(node) )
        if (ruleIndex !== -1 ){
            // try to find next rule
            const nextRuleSet = reversed.slice(ruleIndex+1)
            const nextRuleIndex = nextRuleSet.findIndex( rule => rule.isFor(node) )
            const defaultFn = ( n = node, ctx = context, localInterator = interator ) => {
                if (nextRuleIndex !== -1 ){
                    nextRuleSet[nextRuleIndex].fn( n, ctx, localInterator, ()=>{/* empty default action */})
                } else {
                    return
                }
            }

            if (typeof reversed[ruleIndex].fn !== 'function') {
                console.warn('[pod6] bad fn for ' + JSON.stringify(node,null,2))
            }
            return reversed[ruleIndex].fn( node, context, interator, defaultFn)
        } else {
            // not found rule
            const newNode = { ...node }
            if ( newNode.hasOwnProperty('content') ) {
                return interator( newNode.content, context )
            }
        }
    }
    interator.rules = rules
    return interator
}
export default  thisFunc