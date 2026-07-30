
{
  // the following names: MyBlock, myBlock are use for extending pod6
  function isNamedBlock(name) {
    return (
        name !== name.toLowerCase() 
            && 
        name !== name.toUpperCase() 
      )
  }

  // the following names: =AUTHOR  =DESCRIPTION are reserved
  function isSemanticBlock(name) {
    return name === name.toUpperCase()
  }

  function flattenDeep(arr) {
   return arr.reduce((acc, val) => Array.isArray(val) ? acc.concat(flattenDeep(val)) : acc.concat(val), []);
  }

  function valueKind(v) {
    if (typeof v === 'number') return 'number'
    if (typeof v === 'boolean') return 'boolean'
    return 'string'
  }

  // the same marker line is attempted by several block rules, so one broken
  // value reaches this more than once
  function addDiagnostic(options, message, location) {
    if (!options || !Array.isArray(options.diagnostics)) return
    const seen = options.diagnostics.some(d =>
      d.message === message && d.location.start.offset === location.start.offset)
    if (!seen) {
      options.diagnostics.push({ severity: 'warning', message, location })
    }
  }

  function keepReadable(attrs) {
    return attrs.filter(a => !a.dropped)
  }

  function isSupportedBlockName(name) {
      return [
        'boundary',
        'code',
        'comment',
        'data',
        'data-table',
        'defn',
        'formula',
        'head',
        'include',
        'input',
        'item',
        'markdown',
        'nested',
        'output',
        'para',
        'picture',
        'pod',
        'row',
        'cell',
        'set',
        'table',
        'toc',
          ].includes(name) 
          || 
          isSemanticBlock(name) 
          ||
          // TODO: move detect headers/items level to parser
          name.match(/^(head|item)\d+$/)
          ||
          isNamedBlock(name)
  }

  function exludeVMargin( vmargin, string) {
      if (vmargin.length == 0 ) return string
      if (string.indexOf(vmargin) == 0 ) {
          return string.replace(vmargin, '')
      }
      return string.replace(/^\s+/, '')
  }

}

Document = nodes:Element*  { return nodes }

attributesOnly = _ attrs:attributes* _ { return keepReadable(attrs) }

Element =  delimitedBlockRaw
         / delimitedBlockTableStructured
         / delimitedBlockTable
         / delimitedBlock
         / paragraphBlockRaw 
         / paragraphBlockTable
         / paragraphBlock
         / setDirective
         / aliasDirective
         / configDirective
         / boundaryDirective
         / abbreviatedBlockRaw
         / abbreviatedBlockTable
         / abbreviatedBlock
        / &{ return !!options.podMode === true }
              n:(
                  textBlock
                / blankline
                / error_para 
                ) { return n }
         / (  $(!( markers strictIdentifier / markerAbbreviatedBlock ) .)+)
             { return {
                        text:text(),
                        type:'ambient',
                        location:location()
                      }
              }

/**
U+0020 SPACE
U+00A0 NO-BREAK SPACE
U+0009 CHARACTER TABULATION
U+2001 EM QUAD
U+2008 PUNCTUATION SPACE
*/


hs = [ \u00a0\u2001\t\u000C\u2008]
_ = [ \t\u000C]*
Endline = $(hs* [\n\r])
 
LineOfText = text:$(char+) EOL
   { return text }

//  char =  [a-z =0-9.<>]
char = [^\n\r]
newline = '\n' / '\r' '\n'?
EOL = newline / !.
emptyline = $(hs* [\n\r])
blankline = $( hs* [\n\r]) { return { type:'blankline' } }
markerBegin = '=begin '
markerEnd = '=end '
markerFor = '=for '
markerConfig = '=config'
markerAlias = '=alias'
strictIdentifier =  name:identifier &{ return isSupportedBlockName(name)} { return name }
markerAbbreviatedBlock = '='  name:strictIdentifier { return name }
markers = markerBegin / markerEnd / markerFor / markerConfig / markerAlias
Text "text" = $(c:char+)
// TODO: "markers strictIdentifier" - not properly working for =config C<> and =alias SOME_TEXT
// becouse  C<> and SOME_TEXT is not match to 'strictIdentifier'
text_content =  !( _ ( markerConfig / markerAlias / markers strictIdentifier/ markerAbbreviatedBlock ) / blankline ) $(Text)+ EOL {return text()}
raw_text_until_eol = $(Text)+ EOL {return text()}
error_para = $(!EOL .)+ EOL
            { return { type:"para", value:text(), error:true, location:location()}}
/** 
#  Value is...       Specify with...           Or with...            Or with...
#  ===============   =======================   =================   ===========
#  List              :key[$e1,$e2,...]         :key($e1,$e2,...)
#  List              :key<1 2 3>                :key[1,2,3]       key => [1,2,3]
#  Hash              :key{$k1=>$v1,$k2=>$v2}
#  Boolean (true)    :key                      :key(True)
#  Boolean (false)   :!key                     :key(False)
#  String            :key<str>                 :key('str')         :key("str")
#  Number            :key(42)                  :key(2.3)
*/

array_codes = code:FCode hs+ codes:array_codes {return flattenDeep([code,codes])}/ code:FCode { return [code] }
FCode = $(char)

// Define array: '1 2 3' or '1,2,3'
array_items = 
          code:item ( hs+ / _','_ ) codes:array_items 
                            { return flattenDeep([ code, codes ]) }
          / code:item { return [code] }

identifierKey = $([a-zA-Z0-9]+[a-zA-Z0-9_-]*)

// $k1=>$v1,$k2=>$v2
pair_item =  name:identifierKey _( ',' / '=>')_ value:item { return { [name]: value } }

array_pairs = 
              pair:pair_item  _','_  pairs:array_pairs 
                    { return { ...pair, ...pairs } }
              / code:pair_item { return code }

allow_attribute = _ ':' isFalse:[!]? key:'allow' value:(
  
  '<' _ array:array_codes _ '>'  { return { value:array, type:"array"}}
  / '<' _ '>'  { return { value:[], type:"array"}}
) _  {return { name:'allow', ...value, ...(isFalse ? { isFalse: true } : {})}}

// A list element written without quotes. Only the list-shaped values use it:
// the parenthesised form keeps a permissive fallback that swallows anything up
// to the closing paren, and letting bare words in there would cut that short.
bareWord = $([^ \t\r\n,<>\[\]{}()'"]+)

listItem = item / bareWord

list_items =
          code:listItem ( hs+ / _','_ ) codes:list_items
                            { return flattenDeep([ code, codes ]) }
          / code:listItem { return [code] }

// Angle brackets hold a list only when the content is separated by whitespace:
// `<a b>` is a list, `<a>` and `<a,b>` are strings. Requiring at least one
// separator keeps single values and comma-joined text out of the list branch.
angle_list =
          first:listItem rest:( hs+ i:listItem { return i })+
                            { return flattenDeep([ first, ...rest ]) }

array_sp = all:( _ i:item _ {return i})* { return all }/ res:item {return  [res]} / _ {return []}

attributes =  allow_attribute / _ ':' isFalse:[!]? key:identifier value:(
  
  '{' _  hash:array_pairs _ '}' { return { value:hash, type:"map" } }
  /
  '{' _ '}'  { return { value:{}, type:"map" } }
  /
  '{' $(!('}'/newline) .)* '}'  { return { unreadable:true, location:location() } }
  /
   '['  _ array:(
              array:list_items  { return array }
              /     
              $(!(']'/'[') .)+ {return [text()]}     
              ) _ ']'  
    { return   { 
                value:array,
                type:"array"
              }  
    } 
  /
  '<' _ array:angle_list _ '>'  { return { value:array, type:"array" } }
  /
  '<' _ ['] text:$([^']*) ['] _ '>'  { return { value:text, type:"string" } }
  /
  '<' _ ["] text:$([^"]*) ["] _ '>'  { return { value:text, type:"string" } }
  /
  '<' _ text: $(!('<'/'>') .)+ '>'  { return { value:text.trim(), type:"string" } }
  /
  '<' _ '>'  { return { value:[], type:"array" } }
  /
  '(' _ res:(array:array_items {
                                 return  (array.length > 1)
                                        ? { type:'array', value:array }
                                        : { type:valueKind(array[0]), value:array[0] };
                               }
        /
        $(!(')'/'(') .)+ {return { type:"string", value:text() } }) _ ')'
        { return res }
  /
  '(' _ ')'  { return { value:[], type:"array" } }
  /
  '(' $(!(')'/newline) .)* ')'  { return { unreadable:true, location:location() } }
  /
  ['] text:$([^']*) ['] { return { value:text, type:"string" } }
  /
  ["] text:$([^"]*) ["] { return { value:text, type:"string" } }
  /
  '｢' text:$([^｣]*) '｣' { return { value:text, type:"string" } }
  / _
  { return {
            value:!isFalse,
            type:"boolean"
          }
  }
)  _  {
      if (value.unreadable) {
        addDiagnostic(options, `cannot read the value of :${key}`, value.location)
        return { name:key, dropped:true }
      }
      return { name:key, ...value, ...(isFalse && value.type !== 'boolean' ? { isFalse: true } : {})}
   }

pod_configuration =
  first:attributes* newline
  cont:("=" _ rest:attributes+ _ newline {return rest })*  {return keepReadable(flattenDeep([...first, ...cont]))}

string = text:$([^'"]+){ return text}

digits = $([0-9]+)

number = $([-+]?[0-9]+)

Boolean = 'True' {return true} / 'False' {return false}

floatNumber = $(number ('.' digits)? [eE] number ) / $( number '.' digits )

item =  // quoted strings
        ["] text:$([^"]*) ["] { return text} /
        ['] text:$([^']*) ['] { return text} /
        // boolean
        Boolean /
        // float number
        numberFloat:floatNumber { return parseFloat(numberFloat) } /
        // number
        number:number { return parseInt(number,10) }


delimitedBlockRaw = 
    vmargin:$(_) 
    markerBegin name:strictIdentifier _ config:pod_configuration 
    &{ 
     return ( 
       (name.match(/code|comment|formula|output|input|markdown|picture|toc|data/))
        || 
        isNamedBlock(name)
      )
     }
    content:(
        margins:$(_) 
        line:$( Endline /  //Empty line in Named block 
                ( 
                    !markers  /
                    // close marker should have the same vmargin
                    !(markerEnd ename:strictIdentifier &{ return vmargin.length === margins.length &&  name === ename } )
                )
                    Text  Endline?
              ) { return exludeVMargin(vmargin, `${margins}${line}`) }
            )+ 
    vmargin2:$(_) res:( 
                        markerEnd ename:strictIdentifier &{ return name === ename } Endline? 
                        { 
                          const type = 'block';
                          return {
                                  type:type,
                                  content: content === "" ? [] : [{ type:'verbatim', value:content.join('') }],
                                  name,
                                  margin:vmargin
                                }
                        } 
                  ) &{return  true || vmargin === vmargin2} 
                    { return {
                              ...res,
                              text:text(),
                              config,
                              location:location()
                              }}
tableHeadSeparator = !( _ ( markers / markerAbbreviatedBlock ) / blankline ) hs* $([-+=_|] hs*)+ EOL
                    { return { type: 'separator', text:text() } }

tableBodyRowSeparator  =  $( tableHeadSeparator / &{ return options.isDelimited } blankline ) 
                          { return { 
                                    type:'separator',
                                    text:text()
                                    }
                          }

tableRow = t:text_content { return { name:'row', type:'text', value:t } } 

 tableContents =
    &{  
        // reset separator count and its accum
        options.separators = []
        return true 
      }
    head:$( !tableHeadSeparator tableRow )+
    separator:( t:tableHeadSeparator { // save separator
                    options.separators.push(t.text)
                    return t})
    rest:(
       rowtext:$( !tableBodyRowSeparator tableRow )+
       bseparator:( t:tableBodyRowSeparator { // save separator
                    options.separators.push(t.text)
                    return t})
       {
          return [ 
                  { 
                    name:'row',
                    type:'text',
                    value:rowtext
                  },
                  bseparator 
                ] 
        }

       /
        !tableHeadSeparator !tableBodyRowSeparator singleRow:tableRow { return [singleRow] }

         )+
      &{   // check at this point if this table have header
           //  if more then 1 separator and it equal - table doesn't have header
          if ( options.separators.length  > 1 ) {
              // check if separators equal (for table without header)
              return !options.separators.every( val => val === options.separators[0] )
          }
          return true
          }
      { return [
                  {
                    name:'head',
                    type:'text',
                    value:head
                  },
                  separator,
                  ...flattenDeep(rest) 
                ]
      } 
    / 
      rest:(
        rowtest: $( !tableBodyRowSeparator tableRow )
        bseparator:tableBodyRowSeparator*
        {
          return [ 
                  { 
                    name:'row',
                    type:'text',
                    value:rowtest
                  },
                  bseparator 
                ] 
        }
      )+
      {
          return [...flattenDeep(rest) ]
      }
    / tableRow+

delimitedBlockTableStructured =
    vmargin:$(_)
    markerBegin name:strictIdentifier _ config:pod_configuration
    &{ return name === 'table' }
    &{ options.isDelimited = true; return true }
    content:( nodes:(
            blankline
            / delimitedBlockRaw
            / delimitedBlock
            / paragraphBlockRaw
            / paragraphBlock
            / abbreviatedBlockRaw
            / abbreviatedBlock
            )* { return nodes }
    )
    &{ return content.some(n => n && (n.name === 'row' || n.name === 'cell')) }
    vmargin2:$(_)
    res:(
            markerEnd ename:strictIdentifier &{ return name === ename } Endline?
            {
              return {
                      type:'block',
                      content,
                      name,
                      margin:vmargin
                    }
            }
        )
    {
        return {
                ...res,
                text:text(),
                config,
                location:location()
              }
    }

delimitedBlockTable =
    vmargin:$(_)
    markerBegin name:strictIdentifier _ config:pod_configuration
    &{ return name === 'table' }
    // set type of block
    &{  options.isDelimited = true; return true }
    content:(blankline*  t:tableContents  blankline* {return t} )
    vmargin2:$(_) res:( 
                        markerEnd ename:strictIdentifier &{ return name === ename } Endline? 
                        { 
                          return {
                                  type:'block',
                                  content:content,
                                  name,
                                  margin:vmargin
                                }
                        } 
                  ) &{return  true || vmargin === vmargin2} 
                    {return {
                              ...res,
                              text:text(),
                              config,
                              location:location()
                              }}

delimitedBlock = 
  vmargin:$(_) markerBegin name:strictIdentifier  _ config:pod_configuration
  content:( nodes:(
          blankline
          / delimitedBlockRaw
          / delimitedBlockTable
          / delimitedBlock
          / paragraphBlockRaw
          / paragraphBlockTable 
          / paragraphBlock
          / setDirective
          / aliasDirective
          / configDirective
          / boundaryDirective
          / abbreviatedBlockRaw
          / abbreviatedBlockTable
          / abbreviatedBlock
          //TODO::handle errors
          ) { return nodes} 
  / tvmargin:$( hs* ) 
    text:$(text_content+)
    {
      const type = name.match(/pod|nested|item|code|defn/) 
                  && 
                  (tvmargin.length - vmargin.length) > 0 ? 'code' : 'para'
      return {
              text,
              margin:tvmargin,
              type,
              content: [
                        {
                          type: type === 'code' ? 'verbatim' : 'text',
                          value:text
                        }
                       ],
              location:location(),
              }
    }
  )* 
  vmargin2:$(_) res:(
          markerEnd ename:strictIdentifier &{ return name === ename } Endline? 
          { 
            return { 
                    type:'block',
                    content,
                    name,
                    margin:vmargin,
                  }
          } 
          ) 
          // TODO: fix this 
          &{return  true || vmargin === vmargin2} 
          { 
            return { 
                    ...res,
                    config,
                    location:location(),
                    }
          }

textBlock = ( text_content )+ 
            {
              return { 
                      text: text(),
                      type:'para',
                      margin: '',
                      content:[ 
                                {
                                  type:'text',
                                  value:text()
                                }
                              ],
                      location:location(),
                    }
            }
ambientBlock = line:(emptyline { return  {empty:1}}/ [\s]+ / text_content )+ { return { text: text(), type: "ambient1"}}

abbreviatedBlockRaw = 
  vmargin:$(_) !markers
  name:markerAbbreviatedBlock _ emptyline? 
    &{  
     return ( 
       (name.match(/code|comment|formula|output|input|markdown|picture|toc|data/))
        || 
        isNamedBlock(name)
      )
     }
  content:$(!emptyline text:text_content )*
  { 
    return {
            margin:vmargin,
            type: 'block',
            content: content === "" ? [] : [{ type:'verbatim', value:content}],
            name,
            config:[],
            location:location()
          }
  }

abbreviatedBlockTable = 
  vmargin:$(_) !markers
  name:markerAbbreviatedBlock _ emptyline? 
    &{ return name === 'table' }
  // set type of block
  &{  options.isDelimited = false; return true }
  content:tableContents
  { 
    return {
            margin:vmargin,
            type: 'block',
            content: content === "" ? [] 
                                    : content,
            name,
            config:[],
            location:location()
          }
  }

abbreviatedBlock = 
  vmargin:$(_) !markers
  name:markerAbbreviatedBlock _ first_line:( emptyline / raw_text_until_eol )
  content_rest:$( !emptyline text:text_content )*
  { 
    const content = (first_line === "\n" ? "" : first_line ) + content_rest
    return {
            margin:vmargin,
            type:'block',
            content: content === "" ? [] 
                                    : [
                                        {
                                          type:'para',
                                          text:content,
                                          margin: '',
                                          content:[ 
                                                    {
                                                      type:'text',
                                                      value:content
                                                    }
                                                  ],
                                          location:location(),
                                        }
                                      ],
            name,
            location:location()
          }
  }

alias_replacement_text = 
  first:Text* newline 
  cont:(_"= " _ rest:Text+ _ newline {return rest })*  {return flattenDeep([...first, ...cont])}


// =set assigns attributes to the next block. Configuration syntax carries
// complete delimited attributes; alias syntax carries a value that may span
// `=  ` continuation lines. A continuation starting with `:` holds new
// attributes, any other continuation extends the current alias value.
setLineAttrs = attrs:attributes+ _ EOL { return { kind:'attrs', attrs } }
setLineAlias = _ ':' name:identifier hs+ value:$((!EOL .)+) EOL { return { kind:'alias', name, value } }
setContLine = '=' hs+ seg:( setLineAttrs / v:$((!EOL .)*) EOL { return { kind:'value', value:v } } ) { return seg }

setDirective =
  vmargin:$(_)
  '=set' hs+
  first:( setLineAttrs / setLineAlias )
  cont:setContLine*
  {
      const items = []
      let pending = null
      const flush = () => {
        if (!pending) return
        const value = pending.parts.map(s => s.trim()).filter(s => s.length).join(' ')
        items.push({ name: pending.name, value, type: 'string' })
        pending = null
      }
      for (const seg of [first, ...cont]) {
        if (seg.kind === 'attrs') { flush(); items.push(...seg.attrs) }
        else if (seg.kind === 'alias') { flush(); pending = { name: seg.name, parts: [seg.value] } }
        else if (seg.kind === 'value' && pending) { pending.parts.push(seg.value) }
      }
      flush()
      return {
          type: 'set',
          config: items,
          margin: vmargin,
          location: location()
      }
  }

aliasDirective =
  vmargin:$(_)
  marker:'=alias' _  name:$(identifier) _ replacement:alias_replacement_text
  {
      return {
          name,
          type:'alias',
          replacement,
          margin:vmargin
      }
  }

configDirective =
  vmargin:$(_)
  marker:'=config' _  name:$([A-Z]'<>' / strictIdentifier) _ config:pod_configuration
  {
      return {
          name,
          type:'config',
          config,
          margin:vmargin
      }
  }

boundaryDirective =
  vmargin:$(_)
  marker:'=boundary' _ config:pod_configuration
  {
      return {
          name: 'boundary',
          type: 'block',
          content: [],
          config,
          margin: vmargin,
          location: location()
      }
  }

paragraphBlockRaw = 
  vmargin:$(_)
  marker:markerFor  name:strictIdentifier _ config:pod_configuration 
      &{  
     return ( 
       (name.match(/code|comment|formula|output|input|markdown|picture|toc|data/))
        || 
        isNamedBlock(name)
      )
     }
  content:$(!emptyline text_content)*
  { 
      return { 
              type: 'block',
              content: content === "" ? [] : [{ type:'verbatim', value:content}],
              name,
              margin:vmargin,
              config,
              location:location()
            }
  } 

paragraphBlockTable = 
  vmargin:$(_)
  marker:markerFor  name:strictIdentifier _ config:pod_configuration 
  &{ return name === 'table' }
  // set type of block
  &{  options.isDelimited = false; return true }
  content:tableContents
  { 
      return { 
              type: 'block',
              content: content === "" ? [] : content,
              name,
              margin:vmargin,
              config,
              location:location()
            }
  } 

paragraphBlock = 
  vmargin:$(_) 
  marker:markerFor  name:strictIdentifier _ config:pod_configuration
  content:$(!emptyline text_content)*
  { 
      return { 
              type:'block',
              content: content === "" ? [] 
                                    : [
                                        {
                                          type:'para',
                                          content:[ 
                                                    {
                                                      type:'text',
                                                      value:content
                                                    }
                                                  ],
                                          margin:vmargin,
                                          text:content,
                                          location:location(),
                                        }
                                      ],
              name,
              margin:vmargin,
              config,
              location:location()
            }
  } 

identifier = $([a-zA-Z][a-zA-Z0-9_-]*)

___ "whitespace"
  = [\r\n \t\u000C]*

__ "space characters"
  = [\r\n \t\u000C]*
