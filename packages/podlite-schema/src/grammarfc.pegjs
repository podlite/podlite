{
   function flattenDeep(arr) {
   return arr.reduce((acc, val) => Array.isArray(val) ? acc.concat(flattenDeep(val)) : acc.concat(val), []);
  }
}

Expression
= ( allowed_rules / code / text / raw_text )*
// = ( allowed_rules / code / (text / raw_text)+ {return {type:'text', value:text()}} )*

allowed_rules = code_A / code_S / code_C / code_D / code_E / code_V / code_L / code_X / code_Z 
allpossible_codes = ( 'A' / 'V' / 'R' / 'B' / 'I' / 'C' / 'D' / 'E' / 'K' / 'L' / 'S' / 'T' / 'U' / 'Z' / 'N' / 'X' )
identifier = $([a-zA-Z][a-zA-Z0-9_-]+)
_ = [ \t\u000C]*
allowed_code = 
            char:allpossible_codes 
            &{ return   !(options.allowed || [] ).length  //allow all formatting codes by default
                           ||  
                        (options.allowed || [] ).includes(char)
            }

raw_text= $(.)
content_A = ( !end_code _ id:$(identifier)? _ { return id } )?
code_A = 
    name:start_code &{return name === "A"}
    content: content_A
    end_code
     {
         return  { 
                content,
                'type':"fcode",
                name,
             }
    }

code_D = 
    name:start_code &{return name === "D"}
            
    content: ( text_L )+
     
     synonyms:(
           separator t:array_items*  { return flattenDeep(t) }
           )?
     end_code
     {
         return  { 
                content,
                'type':"fcode",
                name,
                synonyms  
             }
    }

code_V = 
    name:start_code &{return name === "V"}
    content: $( text_C )+ 
    end_code
     {  
         return  { 
                content,
                'type':"fcode",
                name,
             }
    }
allowed_code_C =('B')
looks_like_code_C =(!allowed_code_C .) '<' not_code '>' {return text()}
text_C = text:$( (!'<' .)? '<' text_C? '>' / looks_like_code_C / not_code )+ {return text}
code_C = 
    name:start_code &{return name === "C"}
    content:( text_C )+
    end_code
     {
         return  { 
                content,
                'type':"fcode",
                name,
             }
    }
separator = '|'
text_L = $(
     (!'<' .) '<' text_L '>'
    / 
    !separator !end_code !start_code !looks_like_code . )+ 
code_L = 
    name:start_code &{return name === "L"}
            
    content: (
               code_C  /  text_L 
             )+ 
     
     meta:(
            separator t:$(!end_code .)*  { return t }
           )?
     end_code
     {
         return  { 
                content,
                'type':"fcode",
                name,
                meta
             }
    }
item = $(!';' !end_code .)+
hs = [ \u00a0\u2001\t\u000C\u2008]
array_items = 
          code:item hs*  ';' hs* codes:array_items 
                            { return flattenDeep([ code, codes ]) }
          / code:item { return [code] }

code_X = 
    name:start_code &{return name === "X"}
            
    content: ( text_L )*
     
     entry:(
           separator t:array_items*  { return flattenDeep(t) }
           )?
     end_code
     {
         return  { 
                content,
                'type':"fcode",
                name,
                entry
             }
    }

code_S = 
    name:start_code &{return name === "S"}
    content: $(!end_code .)*
    end_code
     {
         return  { 
                content,
                'type':"fcode",
                name,
             }
    }


code_Z = 
    name:start_code &{return name === "Z"}
    content: $(!end_code .)*
    end_code
     {
         return  { 
                content,
                'type':"fcode",
                name,
             }
    }

/*
    E<0b10101011> and E<0b10111011>.
    Perl 6 makes considerable use of E<171> and E<187>
    Perl 6 makes considerable use of E<0o253> and E<0o273>.
    Perl 6 makes considerable use of E<0d171> and E<0d187>.
    Perl 6 makes considerable use of E<0xAB> and E<0xBB>
    
    # HTML named &raquo;
    Perl 6 makes considerable use of E<laquo> and E<raquo>
    
    # Unicode character name
    Perl 6 makes considerable use of E<LEFT DOUBLE ANGLE BRACKET>
    and E<RIGHT DOUBLE ANGLE BRACKET>.

    Perl 6 makes considerable use of E<LEFT DOUBLE ANGLE BRACKET;hellip;0xBB>.
    
*/

// binary, octal, decimal, or hexadecimal numbers
number = $([0-9]+)
decimalNumber ='0d' number:number { return parseInt(number,10) }
octalNumber = '0o' number:number { return parseInt(number,8) }
binaryNumber = '0b' number:number { return parseInt(number,2) }
hexadecimalNumber = $('0x' ([0-9A-Fa-f])+){ return parseInt(text()) }


// Only numbers is supported at this time
//TODO: add Unicode character name
item_E =  _ number: ( octalNumber / decimalNumber / binaryNumber / hexadecimalNumber / number  ) { return { type: 'number', value:parseInt(number,10)}}
            


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
end_code = '>'
code =  name:start_code &{ return name !== 'C' } content:(  
          allowed_rules / code / text 
        )* end_code  
{ return {content, type:'fcode', name}}
empty =  $(!end_code .)*
text = text:$( '<' text '>' / looks_like_code / not_code )+ {return text}
not_code = text:$(!end_code !start_code !looks_like_code .)+ {return text}
looks_like_code =(!allowed_code .) '<' not_code '>' {return text()}
