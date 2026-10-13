{
   function flattenDeep(arr) {
   return arr.reduce((acc, val) => Array.isArray(val) ? acc.concat(flattenDeep(val)) : acc.concat(val), []);
  }
  function get_pair_tag (tag) {
    const  map = {'<':'>', '«':'»','>':'<', '»':'«'}
    return map[tag]
  }
  // The closing run mirrors the opening one, so the pair is decided while parsing
  // instead of by generating a copy of the rule for every pair the language allows.
  function closeFor (open) {
    return open[0] === '«' ? '»' : '>'.repeat(open.length)
  }
  function closeAt (src, pos, open) {
    const close = closeFor(open)
    return src.substr(pos, close.length) === close
  }
  function link_target (spec) {
    const trimmed = spec.replace(/\s+$/, '')
    const quote = trimmed[0]
    if ((quote === "'" || quote === '"') && trimmed.length > 1 && trimmed[trimmed.length - 1] === quote) {
      return trimmed.slice(1, -1)
    }
    return trimmed
  }
  // callers hand the block-attribute parser in through options; without it the
  // text stays as written rather than being dropped
  function link_items (attrs, options) {
    const read = options && options.parseAttributes
    return typeof read === 'function' ? read(attrs) : attrs
  }
  // codes a `=config C<>` declaration lets act inside that code
  function inner_allowed (options, owner) {
    const map = options && options.allowedIn
    const list = map && map[owner]
    return Array.isArray(list) ? list : []
  }
}

Expression
= ( allowed_rules / code_2 / text / raw_text )*
// = ( allowed_rules / code / (text / raw_text)+ {return {type:'text', value:text()}} )*

allowed_rules = code_A / code_S / code_C / code_D / code_E / code_V / code_L / code_X / code_Z 
allpossible_codes = ( 'A' / 'V' / 'R' / 'B' / 'I' / 'C' / 'D' / 'E' / 'F' / 'G' / 'H' / 'J' / 'K' / 'L' / 'O' / 'S' / 'T' / 'U' / 'W' / 'Z' / 'N' / 'X' )
identifier = $([a-zA-Z][a-zA-Z0-9_-]*)
_ = [ \t\u000C]*
allowed_code = 
            char:allpossible_codes
            &{ return   !(options.allowed || [] ).length  //allow all formatting codes by default
                           ||  
                        (options.allowed || [] ).includes(char)
            }

raw_text= $(.)
// identifier_A = $((!hs .)+)
// content_A = ( !end_code _ id:$(identifier)? _ { return id } )?
// content_A = ( !end_code _ id:$(identifier_A)? _ { return id } )?
FCodeSimple<Letter, Content>
  = name:$Letter
    &{ return !(options.allowed || []).length || (options.allowed || []).includes(name) }
    begin_tag:$('<' / '«')
    content:Content
    end_tag:end_code
    &{ return end_tag === get_pair_tag(begin_tag) }
    { return { content, type: 'fcode', name } }

// the body stops at a code: S<> and Z<> holding a code are left to the rule that reads
// codes, so a pair after the code letter cannot hide the code or close on its delimiter
fcode_content_verbatim = $([^<>«»A-Z]+ / !start_code_2 pair / !start_code_2 !end_code .)*
// an unbalanced angle inside: read up to the first closing one, as before
fcode_content_verbatim_plain = $(!end_code .)*
fcode_content_V = $(text_C)+
// inside guillemets angles are text: only a nested pair of guillemets is balanced
fcode_content_guillemets = $( '«' fcode_content_guillemets '»' / [^«»] )*
fcode_content_D = ( text_L )+
fcode_content_X = ( text_L )*

FCodeWithArray<Letter, ContentRule>
  = name:$Letter
    &{ return !(options.allowed || []).length || (options.allowed || []).includes(name) }
    begin_tag:$('<' / '«')
    content:ContentRule
    items:( separator t:array_items* { return flattenDeep(t) } )?
    end_tag:end_code
    &{ return end_tag === get_pair_tag(begin_tag) }
    { return { name, content, items } }

code_A = FCodeSimple<"A", text_L>
code_V = &{ return inner_allowed(options, 'V').length > 0 } v:FCodeSimple<"V", fcode_content_V_mixed> { return v }
       / name:$"V" &{ return !inner_allowed(options, 'V').length && (!(options.allowed || []).length || (options.allowed || []).includes(name)) } '«' content:fcode_content_guillemets '»' &{ return content.length > 0 }
         { return { content, type: 'fcode', name } }
       / FCodeSimple<"V", fcode_content_V>

inner_code_C = node:( allowed_rules / code_2 ) &{ return inner_allowed(options, 'C').includes(node.name) } { return node }
inner_code_V = node:( allowed_rules / code_2 ) &{ return inner_allowed(options, 'V').includes(node.name) } { return node }
inner_start_C = name:$(allpossible_codes) ('<' / '«') &{ return inner_allowed(options, 'C').includes(name) }
inner_start_V = name:$(allpossible_codes) ('<' / '«') &{ return inner_allowed(options, 'V').includes(name) }
fcode_content_V_mixed = ( inner_code_V / $((pair / !end_code !inner_start_V .)+) )+
code_S = FCodeSimple<"S", fcode_content_verbatim> / FCodeSimple<"S", fcode_content_verbatim_plain>
code_Z = FCodeSimple<"Z", fcode_content_verbatim> / FCodeSimple<"Z", fcode_content_verbatim_plain>

code_D = r:FCodeWithArray<"D", fcode_content_D>
         { return { content: r.content, type: 'fcode', name: r.name, synonyms: r.items } }
code_X = r:FCodeWithArray<"X", fcode_content_X>
         { return { content: r.content, type: 'fcode', name: r.name, entry: r.items } }

allowed_code_C =('B')
looks_like_code_C =(!allowed_code_C ![>»] .)  pair  {return text()}  
text_C = text:$( (!'<' .)? '<' text_C? '>'/ (!'«' .)? '«' text_C? '»' / looks_like_code_C / not_code )+ {return text}
// longest run first, so a doubled opening is not read as a single one
code_open  = $('<<<' / '<<' / '<' / '«')

CodeCRun
  = name:$(allowed_code) &{ return name === "C" } open:code_open
    content:( &{ return open === '<<<' } t:$tail_3 { return [t] } / (
        code_E
        /
        inner_code_C
        /
        text:$( &{ return open.length === 1 } (!'<' !start_code_E !inner_start_C .)? '<' text_C? '>'/ &{ return open.length === 1 } (!'«' !inner_start_C .)? '«' text_C? '»' / &{ return open.length === 1 } (!start_code_E !inner_start_C looks_like_code_C) / &{ return open.length > 1 } ( &{ return open === '<<' } pair_2c / &{ return open === '<<<' } pair_3c ) / text:$(!{ return closeAt(input, location().start.offset, open) } !(&{ return open === '<' } start_code_2) !(&{ return open !== '<' } (start_code_E / inner_start_C)) !(&{ return open.length === 1 } looks_like_code) !(&{ return open.length > 1 } ( &{ return open === '<<' } pair_2c / &{ return open === '<<<' } pair_3c )) .)+ {return text} )+ {return text} )+ )
    // the check sits inside the choice: a longer run matched first must be able to
    // give way to a shorter one, and after the choice there is nothing to give way to
    ( '>>>' &{ return open === '<<<' }
    / '>>'  &{ return open === '<<'  }
    / '>'   &{ return open === '<'   }
    / '»'   &{ return open === '«'   } )
     {
         return  {
                content,
                'type':"fcode",
                name,
             }
    }

code_C = CodeCRun
separator = '|'
text_L = text:$(
        (!'<' !allowed_code .) '<' text_L? '>'
    / 
        (!'«' !allowed_code .)? '«' text_L? '»'
    / 
    !separator !end_code !start_code !looks_like_code . )+ { return text } 

// the configuration region opens at the first whitespace that a colon follows
// straight away; colons inside a URL carry no whitespace before them
link_spec = $( ( !( hs ':' ) [^<>«»] / pair / [<«] )* )
link_spec_filled = $( ( !( hs ':' ) [^<>«»] / pair / [<«] )+ )
link_config =
    hs+ t:$(
        ( ['] [^'\n\r]* ['] / ["] [^"\n\r]* ["] / '<' (!'>' .)* '>' / !end_code . )*
    ) { return t }

// L and W share the [text|]linkspec shape; W adds context to the reference
code_L =
    name:start_code_2 &{return name.code === "L" || name.code === "W"}
    content: (
               code_C  /  code_2  /  text_L
             )+
    separator
    spec:link_spec
    attrs:link_config
    end_tag:end_code &{ return  end_tag === name.end_tag}
    {
        return  {
               content,
               'type':"fcode",
               name:name.code,
               meta:link_target(spec),
               config:link_items(attrs, options)
            }
    }
    /
    name:start_code_2 &{return name.code === "L" || name.code === "W"}
    spec:link_spec_filled
    attrs:link_config
    end_tag:end_code &{ return  end_tag === name.end_tag}
    {
        return  {
               content:[link_target(spec)],
               'type':"fcode",
               name:name.code,
               meta:null,
               config:link_items(attrs, options)
            }
    }
    /
    name:start_code_2 &{return name.code === "L" || name.code === "W"}

    content: (
               code_C  /  code_2  /  text_L
             )+

     meta:(
            separator t:$([^<>«»] / pair / [<«])*  { return t }
           )?
     end_tag:end_code &{ return  end_tag === name.end_tag}
     {
         return  {
                content,
                'type':"fcode",
                name:name.code,
                meta
             }
    }
item = $([^<>«»;] / pair / [<«])+
hs = [ \u00a0\u2001\t\u000C\u2008]
array_items = 
          code:item hs*  ';' hs* codes:array_items 
                            { return flattenDeep([ code, codes ]) }
          / code:item { return [code] }



/*
    E<0b10101011> and E<0b10111011>.
    Podlite makes considerable use of E<171> and E<187>
    Podlite makes considerable use of E<0o253> and E<0o273>.
    Podlite makes considerable use of E<0d171> and E<0d187>.
    Podlite makes considerable use of E<0xAB> and E<0xBB>
    
    # HTML named &raquo;
    Podlite makes considerable use of E<laquo> and E<raquo>
    
    # Unicode character name
    Podlite makes considerable use of E<LEFT DOUBLE ANGLE BRACKET>
    and E<RIGHT DOUBLE ANGLE BRACKET>.

    Podlite makes considerable use of E<LEFT DOUBLE ANGLE BRACKET;hellip;0xBB>.
    
*/

// binary, octal, decimal, or hexadecimal numbers
number = $([0-9]+)
decimalNumber ='0d' number:number { return parseInt(number,10) }
octalNumber = '0o' number:number { return parseInt(number,8) }
binaryNumber = '0b' number:number { return parseInt(number,2) }
hexadecimalNumber = $('0x' ([0-9A-Fa-f])+) { return parseInt(text()) }
unicodeCharacterName = $([A-Z ]+) &{ return  text() === text().toUpperCase() } {return text()}
htmlNamedCharacterReference = s:$([a-z][a-z0-9]+) {return text()}


// Only numbers is supported at this time
//TODO: add Unicode character name
item_E =  _ number: ( octalNumber / decimalNumber / binaryNumber / hexadecimalNumber / number  ) { return { type: 'number', value:parseInt(number,10)}}
        / _ name: unicodeCharacterName { return { type: 'unicode_name', value:name}}
        / _ name: htmlNamedCharacterReference { return { type: 'html_named', value:name}}
            


array_E_items = 
          code:item_E hs*  ';' hs* codes:array_E_items 
                            { return flattenDeep([ code, codes ]) }
          / code:item_E { return [code] }

code_E = 
    name:start_code &{return name === "E"}
    content:  ( t:array_E_items { return flattenDeep(t) } )?
    end_code
     {
         return  { 
                content: content ? content : [],
                'type':"fcode",
                name
             }
    }

start_code = name:$(allowed_code) '<' { return name }
start_code_2 = name:$(allowed_code) begin_tag:$('<' / '«') { return {code:name,begin_tag,end_tag:get_pair_tag(begin_tag)} }
start_code_E = 'E' ('<' / '«')
end_code = '>' / '»'
// TODO: use later this declaration of code_2
// code_2 = 
//         name:start_code_2 &{ return name.code !== 'C' }
//         content:(  
//                   allowed_rules / code_2 /  text  
//            )* 
//         end_tag:end_code &{ return  end_tag === name.end_tag}  
// { return {content, type:'fcode', name:name.code }}

// A code is delimited by a run of angles, and the closing run has to be as long
// as the opening one. The pair is a parameter, so the literals consume their own
// length and a shorter run inside stays part of the content.
CodeRun
      = name:$(allowed_code) &{ return name !== 'C' } open:code_open
        content:( &{ return open === '<<<' } t:$tail_3 { return [t] } / (
                  allowed_rules / code_2 /
                  text:$( &{ return open.length === 1 } '<' text? '>' / &{ return open.length === 1 } '«' text? '»' / &{ return open.length === 1 } looks_like_code / &{ return open.length > 1 } ( &{ return open === '<<' } pair_2 / &{ return open === '<<<' } pair_3 ) /
                    ( text:$(!{ return closeAt(input, location().start.offset, open) } !start_code_2 !(&{ return open.length === 1 } looks_like_code) !(&{ return open.length > 1 } ( &{ return open === '<<' } pair_2 / &{ return open === '<<<' } pair_3 )) .)+ {return text})
                                                                         )+ {return text}
           )* )
        ( '>>>' &{ return open === '<<<' }
        / '>>'  &{ return open === '<<'  }
        / '>'   &{ return open === '<'   }
        / '»'   &{ return open === '«'   } )
{ return {content, type:'fcode', name }}

code_2 = CodeRun


empty =  $(!end_code .)*
//  text = text:$( '<' text '>' / looks_like_code / not_code )+ {return text}
text = text:$( '<' text? '>' / '«' text? '»' / looks_like_code / not_code  )+ {return text}

not_code = text:$(!end_code !start_code_2 !looks_like_code .)+ {return text}
looks_like_code =(!allowed_code ![>»] .)  pair  {return text()}  

// an angle pair inside a code, empty or holding further pairs, is part of its content;
// a code started inside it leaves it to the code rules
pair = '<' ( pair / !start_code_2 !'<' !'>' !'»' . )* '>' / '«' ( pair / !start_code_2 !'«' !'»' !'>' . )* '»'

// inside a code opened by a longer run only a run of the same length nests, and it has
// to be balanced; shorter angles are plain text. A run with a code inside is left to the
// code rules, as a single pair is
pair_2 = '<<' ( pair_2 / !start_code_2 !'>>' !'<<' . )* '>>'
pair_3 = '<<<' ( pair_3 / !start_code_2 !'>>>' !'<<<' . )* '>>>'
// inside C<> only E<> and the codes a declaration allows there are codes
pair_2c = '<<' ( pair_2c / !active_code_E !inner_start_C !'>>' !'<<' . )* '>>'
pair_3c = '<<<' ( pair_3c / !active_code_E !inner_start_C !'>>>' !'<<<' . )* '>>>'
// E<> as a code where the context lets it act; the entity code is read with angles only
active_code_E = name:$(allowed_code) &{ return name === 'E' } '<'

// the opening run is taken from the left, so a run longer than three leaves its first
// angles to the content (only <<< can be followed by one more angle); a single pair standing there, with the closing run right after it,
// is the whole content: the closing run is taken from the right
tail_3 = '<' (!start_code_2 !'<' !'>' !'»' .)+ '>' &'>>>'
