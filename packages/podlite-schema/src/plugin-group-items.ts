
import makeAttrs from './helpers/config'
export default () =>( tree )=>{
  const isNodesEqual = ( n1, n2 ) => (
      // if nodes items 
      ( n1.name === 'item' ||  n1.name === 'defn' )&&  
      n2.name === n1.name &&
      n1['level'] === n2.level && 
      isNumbered(n1) === isNumbered(n2)
   ) 

const isNumbered = ( node ) => Boolean(makeAttrs(node, {}).exists('numbered'))

const group = ( a, level = 1 ) => {
  const isInListMode = ( a ) => { return  a.length > 0 && a[a.length-1].type === 'list' }
  const getList = (a) => { if(isInListMode(a)) return a[a.length-1] }
  const isInsertableToList = ( l, i ) => (
          i.name && i.name === 'item' && i.type && i.type === 'block'
           ||
           i.type === 'blankline'
   )
  let lastItem = {}
  
  let result =  a.reduce((
    a, i 
  ) => {
   // skip items out of level
   if ( i.name === 'item' && i.type === 'block' &&  i.level < level ) {
       return [ ...a, i ]
   }
   if ( i.name === 'item'  && i.type === 'block' && (
          !isInListMode(a)
             ||
          // different type of list and item
          // at the same  level
          ( i.level === level
                   &&
              getList(a).list !== (isNumbered(i) ? 'ordered' : 'itemized' )
          )
      )) {
              // create empty list
              // list = ['ordered', 'variable', 'itemized']
              a.push({
                      type:'list',
                      level: i.level,
                      content:[],
                      list:isNumbered(i) ? 'ordered' : 'itemized'
              })
           }
   // main logic
      if (isInListMode(a)
          && isInsertableToList( getList(a), i )) 
      {  // getlist and push item to them
          getList(a).content.push(i)
      }
      else { a.push(i) }
    return a
  }, [])
  // convert grouped items into object 'itemlist'
  /**
   * { type = 'list',
   *   ordered = [true, false]
   *   content = [ .... ]
   *   list = ['ordered', 'variable', 'itemized']
   */
  return result.map( item => { 
      // process any item with content ( except formatting codes)
      if (item.content && item.type !== 'fcode') {
          item.content = group( item.content, item.level + 1 )
      }
      return item
  })
}
  const visit = ( node ) => {
    if ( Array.isArray( node ) ) {
         node = group( node )
    } else {
      if ( node.type === 'block' && node.name !== 'table') {
        node.content = group( node.content )
      }
    }
    return node
  }
  tree = visit(tree)
  return tree
}
