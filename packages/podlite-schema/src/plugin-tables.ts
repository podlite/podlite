/**
 * Plugin for fill term's for defn. From S26:
 * The first non-blank line of content is treated as a term being defined,
 * and the remaining content is treated as the definition for the term.
 */
import makeTransformer from './helpers/makeTransformer'
function flattenDeep(arr) {
    return arr.reduce((acc, val) => Array.isArray(val) ? acc.concat(flattenDeep(val)) : acc.concat(val), []);
}
/**
 *  Helpers section
 */

  // run cb in symbols pair        
  const strbin = (str1, str2, cb ) => {
    let res = []
    for( let i =0; str1.length > i ; i++) {
        res.push( cb(  
                parseInt( str1[i], 10),
                parseInt(str2[i],10)
                    ))
    }
    return res.join('')
  }

  // Create mask for extract columns
  const makeMask = ( lines, separators ) => {
          // calculate template length
          const tmplLength = Math.max( ...[...lines, ...separators].map( s => s.length) )
          // make bin mask for each string
          const masks = lines.map((str)=>{
              /** make mask for each line
                '        The Shoveller | Eddie Stevens   | King Arthur\'s singing shovel', 
                '0000000011111111111110001111111111111000001111111111111111111111111111' ] 
                then  not(mask) ... then  & masks
               */
              // enlarge string to tmplLength
              let tstr = str + " ".repeat(tmplLength -str.length )
              let mask = []
              const re = /\s+[+|\s]\s/g
              let match
              while ((match = re.exec(tstr)) != null) {
                  const tmpMask =  
                              '1'.repeat(match.index) + 
                              '0'.repeat(match[0].length)
                  mask.push(tmpMask + '1'.repeat(tmplLength - tmpMask.length))
              }
              return mask.reduce( ( a, b )=>{ return strbin( a, b, ( i1, i2 ) => i1 & i2 ) }, '1'.repeat(tmplLength) )
          })
          // make result mask
          const inverted = masks.map( m => strbin(m,'',(i1)=> i1 == 0 ? 1 : 0 ) )
          const  columnTemplate = inverted.reduce( (a,b)=>{ return strbin(a,b,(i1,i2)=>i1 & i2 ) }, '1'.repeat(tmplLength))
          return columnTemplate
  }

  const extractColumnsByTemplate  = ( text, template ) => {
      const lines = flattenDeep(
           text.split(/\n/)  // split each row by eol
          .filter((str)=>str.length > 0 ) // filter empty strings ( after slit )
      )
      const cols = lines.map(line=>{
          const re = /((1+|0+))/g
          let columns = []
          let match
          while ((match = re.exec(template)) != null) {
              if (match[0][0] == 1 ) continue
              const s = line.substring(match.index, match.index + match[0].length)
              columns.push(s)
          }
          return columns
      })
      let result = []
      result = cols.reduce( (a,b)=>{
          for ( let i=0 ; i < b.length; i++) {
              a[i] = (a[i] === undefined ? '': a[i] ) + ' ' + b[i]
          }
          return a
      }, [] )
      return result
  }

  /**
   *  Main transforms
   */

  export default () =>( tree )=>{
  const transformer = makeTransformer({'table' : (node) => {
    let rows = []
    const collectValues = (row) => { rows.push(row.value) }
    // collect separators for calculate max length of rows
    let seps = []
    makeTransformer({
                'row:text'  : collectValues,
                'head:text' : collectValues,
                ':separator': (sep) => { seps.push(sep.text) }
    })(node)
    // add table-caption
    // if table empty return node as is
    if (!rows.length) return node

    const splitToLines = (row)=>row.split(/\n/)  // split each row by eol
                         .filter((str)=>str.length > 0 ) // filter empty strings ( after slit )
                         
    // split each row into lines
    const lines = flattenDeep( rows.map(splitToLines) )
    const separators = flattenDeep( seps.map(splitToLines) )

    // collect text rows
    let textRows = []
    makeTransformer({
                'row:text'  : (row) => { textRows.push(row.value)}
    })(node)

    const columnTemplate = makeMask(lines, separators)
    const makeBlock = (name, content, ...attr) => { return { ...attr, name, type: 'block', content: Array.isArray(content) ? content : [content] } }
    // make columns
    const res = makeTransformer({
        'row:text'  : (row) => {
            
            if (textRows.length ==1 ) {
                // split each text row into lines
                const textRowsLines = flattenDeep( [row.value].map(splitToLines))
                return textRowsLines.map( (rowValue)=>{
                    const res = extractColumnsByTemplate( rowValue, columnTemplate )
                    return makeBlock(
                        'table_row',
                         res.map((col)=>makeBlock(
                             'table_cell',
                             {type:'text',value:col}
                            )),
                    )
                })
    
            }
            const res = extractColumnsByTemplate( row.value, columnTemplate )
            return makeBlock(
                'table_row',
                 res.map((col)=>makeBlock(
                     'table_cell',
                     {type:'text',value:col}
                    )),
            )
        },
        'head:text' : (head) => {
            const res = extractColumnsByTemplate( head.value, columnTemplate )
            return makeBlock(
                'table_head',
                 res.map((col)=>makeBlock(
                     'table_cell',
                     {type:'text',value:col}
                    )),
            )
        },
    })(node)
    
    return res
}})
return transformer(tree, {})
}

