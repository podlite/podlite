
import { makePlug, makeRule } from "./helpers/makeQuery";
// skip warnings for semantic blocks
export function isSemanticBlock ( node ) { 
    const name = node.name || ''
    const isTypeBlock = ( node.type || '') === 'block'
    return isTypeBlock && name === name.toUpperCase()
}

function flattenDeep(arr) {
    return arr.reduce((acc, val) => Array.isArray(val) ? acc.concat(flattenDeep(val)) : acc.concat(val), []);
}

export const makeInterator  = ( rule ) => {
    let rules = []
    function use( key, fn?:any )  {
        if ( key instanceof Array ) {
           console.warn(`[podlite-interator] Unsupported param for ${key}`)
        }
      
        if ( key instanceof Object ) {
          for ( var prop in key ) {
              if ( key.hasOwnProperty(prop) ) {
                  use( prop, key[prop] )
              }
          }
          return []
        }
        rules.push( makeRule( makePlug(key), fn ) )
      }

    function visiter (node, context:any = {} )  {
        if (node instanceof Array) {
            return flattenDeep(node.map( item => visiter(item, context) )).filter(Boolean)
        }
        if ( 'string' === typeof node ) {
            // convert string to lex node with type 
            return visiter({type:'text', value:node}, context)
            return node
        }
        // get first rule for this node
        const reversed = rules.slice()
        reversed.reverse()
        const ruleIndex = reversed.findIndex( rule => rule.isFor(node) )
        if (ruleIndex !== -1 ){
            return reversed[ruleIndex].fn( node, context, visiter )
        } else {
            // not found rule
            const newNode = { ...node }
            if ( newNode.hasOwnProperty('content') ) {
                newNode.content = visiter( newNode.content, context )
            }
            return newNode
        }
    }
    use(rule)
    visiter.rules = rules
    return visiter
}
export default makeInterator