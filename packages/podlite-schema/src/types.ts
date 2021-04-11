
export interface RuleHandler {
    (  writer?:any, processor?:any ) :  ( node:PodNode, ctx?:any, interator?:any ) => void | AstTree | PodNode
}
export interface Plugin {
    toAst?: RuleHandler,
    toHtml?: RuleHandler,
}


export interface Plugins {
    [ name: string ] : Plugin
}


export interface genericRule<NodeType> {
    (writer?: any, processor?: any): (node: NodeType, ctx?: any, interator?: any) => void | AstTree | PodNode;
}
export interface Rules {
    [name: string]: RuleHandler;
    'A<>': genericRule<FormattingCodeA>;
    'E<>': genericRule<FormattingCodeE>,
    'D<>': genericRule<FormattingCodeD>,
    'N<>': genericRule<FormattingCodeN>,
    'X<>': genericRule<FormattingCodeX>,
    'S<>': genericRule<FormattingCodeS>,
    'table:block': genericRule<FormattingCodeD>,
}

export interface Position {
    line: number;
    column: number;
    offset: number;
}
export interface Location {
    start:Position;
    end:Position;
}

export interface Image {
        type:'image',
        src:string,
        alt?: string
}
// extra definitions
export interface BlockImage extends Omit<Block, 'content'>{
    name: 'image'
    content:[Image] 
}

export interface RootBlock extends  Omit<Block, 'location'>{
    name: 'root'
    content:AstTree
}

// pod6 definitions 

export interface FormattingCodeB {
    type:"fcode",
    name: "B",
    content?: Array<Node>,
}

export interface FormattingCodeC {
    type:"fcode",
    name: "C",
    content?: Array<FormattingCodes|string>
}

export interface FormattingCodeE {
    type:"fcode",
    name: "E",
    content: Array<{ 
            type: "number",
            value: number
    }>
}


export interface FormattingCodeN {
    type:"fcode",
    name: "N",
    content?: Array<FormattingCodes|string>
}

export interface FormattingCodeX {
    type:"fcode",
    name: "X",
    entry: Array<string> | null,
    content?: Array<FormattingCodes|string>
}

export interface FormattingCodeZ {
    type:"fcode",
    name: "Z",
    content?: string,
}

export interface FormattingCodeV {
    type:"fcode",
    name: "V",
    content?: string,
}

export interface FormattingCodeS {
    type:"fcode",
    name: "S",
    content?: string,
}

export interface FormattingCodeA {
    type:"fcode",
    name: "A",
    content: string,
}

export interface FormattingCodeD {
    type:"fcode",
    name: "D",
    synonyms: Array<string>,
    content: string,
}

export interface FormattingCodeAny {
    type:"fcode",
    name: string,
    content?: Array<FormattingCodes|string>
}


export interface Verbatim {
   type: "verbatim",
   value: string,
}

export interface Text {
    type:"text",
    value:string,
}
export interface Para {
    type: "para";
    text:string;
    margin:string;
    location:Location;
    content: Array<Node | FormattingCodes>;
}

export interface Code {
    type: "code"; 
    text:string; 
    margin:string;
    location:Location;
    content: Array<Verbatim|string>;
}

// blank line
export interface BlankLine {
    type: "blankline";
}

// Special element for grouping list items
export interface List {
    type: "list"; 
    level: string|number, // TODO: eliminate string
    content: Array<Node>;
    list:"itemized"
}

export interface ConfigItemKV {
    [key:string]: string|number|boolean
}
// TODO:: find this case
export interface BrokenConfigItem extends Omit<ConfigItem, 'type'>{ 
}

export interface ConfigItem {
    name: string,
    value: boolean | string | number | Array<string|number|boolean> | ConfigItemKV,
    type: string,
}

export interface BlockConfig {
    name: string,
    type: "config",
    config: Array<ConfigItem>,
    margin: string,
}

export interface Alias {
    name: string,
    type: "alias",
    replacement: Array<string>,
    margin: string,
}

export interface Block {
    type: "block";
    location:Location;
    content: Array<Node>;
    margin:string;
    config?:Array<ConfigItem|BrokenConfigItem>;
}


export interface BlockItem extends Block {
    name: "item",
    level: string,
}
export interface BlockPara extends Block {
    name: "para";
}

export interface BlockTable extends Omit<Block,'content'> {
    name: "table";
    content:Array<TableHead|TableSeparator|TableRow>,
    // why text not always presents here
    text?: string, 
}
export interface TableCell {
    name: "table_cell",
    type: "block",
    content: Array<string>
}
export interface TableRow {
    name: "table_row",
    type: "block",
    content: Array<TableCell>
}

export interface TableHead {
    name: "table_head",
    type: "block",
    content: Array<TableCell>
}
export interface TableSeparator {
    "type": "separator",
    "text": string,
}

export interface BlockAny extends Block {
    name: Capitalize<string>;
}
export type FormattingCodes = 
    | FormattingCodeA
    | FormattingCodeC
    | FormattingCodeB
    | FormattingCodeD
    | FormattingCodeE
    | FormattingCodeN
    | FormattingCodeX
    | FormattingCodeZ
    | FormattingCodeV
    | FormattingCodeS
    | FormattingCodeAny

export type PodNode = 
    | BlockPara
    | BlankLine
    | string
    | Para
    | Text
    | Code
    | BlockAny
    | Verbatim
    | BlockTable
    | List
    | BlockConfig
    | BlockItem
    | Alias
    // extra types
    | BlockImage
    | Image
    | RootBlock
    // Fomatting codes
    | FormattingCodes
export type Node = PodNode
export type AstTree = Array<PodNode>
export type PodliteDocument = RootBlock