import * as React from 'react'

export interface RuleHandler<T = any> {
  (writer: any, processor: any, tree: PodliteDocument): (node: T, ctx: any, interator: any) => void | AstTree | PodNode
}

type createComponentParams = PodNode & { children: React.ReactNode[] } & { key: string | number }

export type JSXHelper = (
  src: string | (({}: createComponentParams, children: React.ReactNode[]) => React.ReactNode[] | React.ReactNode),
  node: PodNode | {},
  children: React.ReactNode[],
  extraProps?: {},
  ctx?: {},
) => any

export interface Plugin<T = any> {
  toAst?: RuleHandler<T>
  toAstAfter?: RuleHandler<T> // second pass
  toHtml?: RuleHandler<T>
  toJSX?: (helper: JSXHelper) => RuleHandler<T>
}

export interface Plugins {
  [name: string]: Plugin
}

interface checkFn<T> {
  (node: T, ctx: any): any
}
interface SetFn<T> {
  (check: checkFn<T>): RuleHandler<T>
}
export interface RulesStrict {
  'A<>': RuleHandler<FormattingCodeA>
  'B<>': RuleHandler<FormattingCodeB>
  'C<>': RuleHandler<FormattingCodeC>
  'D<>': RuleHandler<FormattingCodeD>
  'E<>': RuleHandler<FormattingCodeE>
  'F<>': RuleHandler<FormattingCodeF>
  'I<>': RuleHandler<FormattingCodeI>
  'K<>': RuleHandler<FormattingCodeAny>
  'R<>': RuleHandler<FormattingCodeAny>
  'T<>': RuleHandler<FormattingCodeAny>
  'V<>': RuleHandler<FormattingCodeAny>
  'N<>': RuleHandler<FormattingCodeN>
  'X<>': RuleHandler<FormattingCodeX>
  'S<>': RuleHandler<FormattingCodeS>
  'L<>': RuleHandler<FormattingCodeL>
  'U<>': RuleHandler<FormattingCodeAny>
  'Z<>': RuleHandler<FormattingCodeAny>
  // "Delete" inline element ( aka strikethrough )
  // from Markdown ast
  'Delete<>': RuleHandler<FormattingCodeAny>

  pod: RuleHandler<Para>
  root: RuleHandler<RootBlock>

  ':para': RuleHandler<Para>
  ':text': RuleHandler<Text>
  ':blankline': RuleHandler<BlankLine>
  ':ambient': RuleHandler<Ambient>
  ':code': RuleHandler<Code>
  ':verbatim': RuleHandler<Verbatim>
  ':list': RuleHandler<List>

  // Directives
  ':config': RuleHandler<BlockConfig>
  ':alias': RuleHandler<Alias>

  data: RuleHandler<BlockData>
  code: RuleHandler<BlockCode>
  para: RuleHandler<BlockPara>
  defn: RuleHandler<BlockDefn>
  nested: RuleHandler<BlockNested>
  output: RuleHandler<BlockOutput>
  input: RuleHandler<BlockInput>
  picture: RuleHandler<BlockPicture>
  image: RuleHandler<BlockImage>
  ':image': RuleHandler<Image>

  'item:block': RuleHandler<BlockItem>
  item: RuleHandler<BlockItem>

  'comment:block': RuleHandler<BlockComment>
  comment: RuleHandler<BlockComment>

  'head:block': RuleHandler<BlockHead>
  head: RuleHandler<BlockHead>

  //group type
  ':fcode': RuleHandler<FormattingCodes>

  'table:block': RuleHandler<BlockTable>
  table: RuleHandler<BlockTable>
  ':separator': RuleHandler<Separator>
  table_row: RuleHandler<TableRow>
  table_cell: RuleHandler<TableCell>
  table_head: RuleHandler<TableHead>

  //toc
  toc: RuleHandler<BlockToc>
  ':toc': RuleHandler<Toc>
  ':toc-list': RuleHandler<TocList>
  ':toc-item': RuleHandler<TocItem>

  markdown: RuleHandler<BlockMarkdown>
  // User-defined
  // TODO deprecate Diagram
  Diagram: RuleHandler<BlockDiagram>
  Mermaid: RuleHandler<BlockMermaid>
  // TODO deprecate Image
  Image: RuleHandler<BlockNamed>
}

export interface Rules extends RulesStrict {
  [name: string]: RuleHandler
}
export interface Position {
  line: number
  column: number
  offset: number
}
export interface Location {
  start: Position
  end: Position
}

export interface Image {
  type: 'image'
  src: string
  alt?: string
}

// Table of contents
export interface Toc {
  type: 'toc'
  title?: string
  content: TocList
}
export interface TocList {
  type: 'toc-list'
  level: number
  content: Array<TocItem | TocList>
}

export interface TocItem {
  type: 'toc-item'
  node: PodNode
  content: Array<Node>
}

// extra definitions
export interface BlockImage extends Omit<Block, 'content'> {
  name: 'image'
  caption?: string //TODO: move caption into content and make it optional and may contain multiple nodes
  link?: string
  content: [Image, BlockCaption?]
}

export interface BlockPicture extends Omit<Block, 'content'> {
  name: 'picture'
  caption?: string //TODO: move caption into content and make it optional and may contain multiple nodes
  link?: string
  content: [Image, BlockCaption?]
}

export interface BlockCaption extends Omit<Block, 'content' | 'location' | 'margin' | 'config' | 'id'> {
  name: 'caption'
  content: Array<Node>
}
export interface RootBlock extends Omit<Block, 'location'> {
  name: 'root'
  content: AstTree
}

// pod6 definitions

export interface FormattingCodeB {
  type: 'fcode'
  name: 'B'
  content?: Array<Node>
}

export interface FormattingCodeC {
  type: 'fcode'
  name: 'C'
  content?: Array<FormattingCodes | string>
}

export interface FormattingCodeE {
  type: 'fcode'
  name: 'E'
  content: Array<
    | {
        type: 'number'
        value: number
      }
    | {
        type: 'unicode_name'
        value: string
      }
    | {
        type: 'html_named'
        value: string
      }
  >
}
export interface FormattingCodeF {
  type: 'fcode'
  name: 'F'
  content: Array<{
    type: 'text'
    value: string
  }>
}

export interface FormattingCodeN {
  type: 'fcode'
  name: 'N'
  content?: Array<FormattingCodes | string>
}

export interface FormattingCodeX {
  type: 'fcode'
  name: 'X'
  entry: Array<string> | null
  content?: Array<FormattingCodes | string>
}

export interface FormattingCodeZ {
  type: 'fcode'
  name: 'Z'
  content?: string
}

export interface FormattingCodeV {
  type: 'fcode'
  name: 'V'
  content?: string
}

export interface FormattingCodeS {
  type: 'fcode'
  name: 'S'
  content?: string | Text
}

export interface FormattingCodeA {
  type: 'fcode'
  name: 'A'
  content: string | Text
}

export interface FormattingCodeD {
  type: 'fcode'
  name: 'D'
  synonyms: Array<string>
  content: string
}

export interface FormattingCodeL {
  type: 'fcode'
  name: 'L'
  meta: string | null
  content: string | Text | [Text] // TODO: link content can contain other formatting codes
}

export interface FormattingCodeI {
  type: 'fcode'
  name: 'I'
  meta: string
  content: string | Text
}
export interface FormattingCodeAny {
  type: 'fcode'
  name: string
  content?: Array<FormattingCodes | string>
}

export interface Ambient {
  type: 'ambient'
  text: string // TODO: change type name to 'value'
  location: Location
}

export interface Verbatim {
  type: 'verbatim'
  value: string
}

export interface Text {
  type: 'text'
  value: string
}
export interface Para {
  type: 'para'
  text: string
  margin: string
  location: Location
  content: Array<Node | FormattingCodes>
}

export interface Code {
  type: 'code'
  text: string
  margin: string
  location: Location
  content: Array<Verbatim | string>
}

// blank line
export interface BlankLine {
  type: 'blankline'
}

// Special element for grouping list items
export interface List {
  type: 'list'
  level: string | number // TODO: eliminate string
  content: Array<BlockItem | BlankLine | List>
  list: 'itemized'
}

export interface ConfigItemKV {
  [key: string]: string | number | boolean
}
// TODO:: find this case
export interface BrokenConfigItem extends Omit<ConfigItem, 'type'> {}

export interface ConfigItem {
  name: string
  value: boolean | string | number | Array<string | number | boolean> | ConfigItemKV
  type: string
}

//TODO: rename it to Config like Alias ?
export interface BlockConfig {
  name: string
  type: 'config'
  config: Array<ConfigItem>
  margin: string
}

export interface Alias {
  name: string
  type: 'alias'
  replacement: Array<string>
  margin: string
}

export interface Separator {
  type: 'separator'
  text: string
}
export interface Block {
  type: 'block'
  location: Location
  content: Array<Node>
  margin: string
  config?: Array<ConfigItem | BrokenConfigItem>
  id?: string // TODO: should it be non-optional?
}

export interface BlockPod extends Block {
  name: 'pod'
}

export interface BlockData extends Block {
  name: 'data'
}

export interface BlockComment extends Block {
  name: 'comment'
}
export interface BlockDefn extends Block {
  //TODO: check defined list for extra fields
  name: 'defn'
}
export interface BlockItem extends Block {
  name: 'item'
  content: Array<Node>
  level: string | number // TODO: find source of string, must be number
}

export interface BlockOutput extends Block {
  name: 'output'
}

export interface BlockInput extends Block {
  name: 'input'
}

export interface BlockPara extends Block {
  name: 'para'
}

export interface BlockCode extends Block {
  name: 'code'
}

export interface BlockToc extends Block {
  name: 'toc'
}
export interface BlockMarkdown extends Block {
  name: 'markdown'
}
export interface BlockNested extends Block {
  name: 'nested'
}
export interface BlockHead extends Block {
  name: 'head'
  level: number | string //TODO: must be only number
}
export interface BlockTable extends Omit<Block, 'content'> {
  name: 'table'
  content: Array<TableHead | TableSeparator | TableRow | BlankLine>
  align?: ('left' | 'center' | 'right' | null)[]
  // why text not always presents here
  text?: string
}
export interface TableCell {
  name: 'table_cell'
  type: 'block'
  content: Array<string>
}
export interface TableRow {
  name: 'table_row'
  type: 'block'
  content: Array<TableCell>
}

export interface TableHead {
  name: 'table_head'
  type: 'block'
  content: Array<TableCell>
}
export interface TableSeparator {
  type: 'separator'
  text: string
}

export type BlockAny = BlockNamed

export interface BlockNamed extends Omit<Block, 'content'> {
  name: string
  // using RootBlock for MD chunks or Include for documents
  content: [(Verbatim | Para | Code)?] | Array<Image | BlockCaption> | RootBlock // TODO: use one of Verbatim or Code types
}

// TODO:deprecated
export interface BlockDiagram extends Omit<BlockNamed, 'content'> {
  name: 'Diagram'
  content: [Verbatim]
  custom?: { location: Location }
}
export interface BlockMermaid extends Omit<BlockNamed, 'content'> {
  name: 'Mermaid'
  content: [Verbatim]
  custom?: { location: Location }
}

export interface BlockFormula extends Omit<BlockNamed, 'content'> {
  name: 'formula'
  content: [Verbatim]
}

export type FormattingCodes =
  | FormattingCodeA
  | FormattingCodeC
  | FormattingCodeB
  | FormattingCodeD
  | FormattingCodeE
  | FormattingCodeF
  | FormattingCodeI
  | FormattingCodeL
  | FormattingCodeN
  | FormattingCodeX
  | FormattingCodeZ
  | FormattingCodeV
  | FormattingCodeS
  | FormattingCodeAny

export type PodNode =
  | Ambient //TODO: Needs move to outside of 'pod' block ?
  | BlockPod
  | BlockData
  | BlockFormula
  | BlockCode
  | BlankLine
  | BlockNested
  | BlockMarkdown
  | BlockOutput
  | BlockInput
  | BlockPara
  | BlockHead
  | BlockComment
  | BlockDefn
  | string
  | Para
  | Text
  | Code
  | BlockNamed
  | BlockAny
  | Verbatim
  | BlockTable
  | List
  | BlockConfig
  | BlockItem
  | Alias
  | BlockToc
  | BlockPicture
  // extra types
  | BlockImage
  | Image // :TODO: if it inline element, it should be in Para
  | RootBlock
  | Separator
  | BlockCaption
  // Fomatting codes
  | FormattingCodes
  | Toc
export type Node = PodNode
export type AstTree = Array<PodNode>
export type PodliteDocument = RootBlock
