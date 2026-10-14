import { ParserPlugin, Node, nPara } from './'

// the characters the grammar reads as indent; a tab moves on to the next multiple of 8
const INDENT = /^[ \u00a0\u2001\t\u000C\u2008]*/gm
const TABSTOP = 8

const widthOf = (indent: string): number =>
  [...indent].reduce((column, ch) => (ch === '\t' ? (Math.floor(column / TABSTOP) + 1) * TABSTOP : column + 1), 0)

// every line loses as many columns as the first one was set in by; what is left of
// its indent keeps its width
const takeIndent = (text: string, width: number): string =>
  text.replace(INDENT, indent => ' '.repeat(Math.max(0, widthOf(indent) - width)))

const middle: ParserPlugin = () => tree => {
  const visit_node = (node: Node, context: { margin?: string; nest?: any } = {}) => {
    // if( (node.type || "").match(/(code|text)/) ) {
    if (node.type == 'code' || node.type == 'text') {
      if (node.margin && context.margin && context.margin.length > 0 && context.margin.length == node.margin.length) {
        ;(node as any).type = 'para'
      }
      if (node.type === 'code') {
        // the indent that made the text code is its nesting, not part of it
        const width = widthOf(node.margin)
        node.text = takeIndent(node.text, width)
        // the renderers write content, so it loses the indent text loses
        const parts: Array<{ type?: string; value?: unknown }> = node.content
        for (const part of parts) {
          if (part.type === 'verbatim' && typeof part.value === 'string') part.value = takeIndent(part.value, width)
        }
      }
    }

    if (node.type === 'block') {
      // a block's margin holds for its own content and ends with the block
      const inner = { ...context, margin: typeof node.margin !== 'string' ? '' : node.margin }
      inner.nest = (inner.nest || 0) + 1
      node.content.map(n => {
        visit_node(n, inner)
      })
    }
  }
  var ctx = {}
  tree.forEach(n => visit_node(n, ctx))
  return tree
}
export default middle
