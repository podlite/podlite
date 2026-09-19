import { content as nodeContent, Plugins } from '@podlite/schema'
import { Plugin } from '@podlite/schema'
import { md2ast } from './tools'

export const plugin: Plugin = {
  toAst: (_, processor) => (node, ctx) => {
    if (typeof node !== 'string' && 'type' in node && 'content' in node && node.type === 'block') {
      const content = node.content[0]
      if (content && typeof content !== 'string' && 'location' in node && 'value' in content) {
        const lineOffset = node.location.start.line
        const body = String(content.value)
        // a delimited block keeps its text and strips its indent from the body;
        // the other forms end where the body ends
        const written = 'text' in node && typeof node.text === 'string' ? node.text : undefined
        const bodyOffset = written
          ? node.location.start.offset + written.indexOf('\n') + 1
          : node.location.end.offset - body.length
        const margin = written && typeof node.margin === 'string' ? node.margin.length : 0
        return { ...node, content: md2ast(content, { lineOffset, bodyOffset, margin }) }
      }
      return node
    }
  },
  toJSX: helper => {
    return nodeContent
  },
}
export const PluginRegister: Plugins = {
  Markdown: plugin, //TODO: deprecate it
  markdown: plugin,
}

export { md2ast as parseMd } from './tools'
export default plugin
