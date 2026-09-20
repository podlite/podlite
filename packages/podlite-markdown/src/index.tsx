import { content as nodeContent, Plugins } from '@podlite/schema'
import { Plugin } from '@podlite/schema'
import { md2ast } from './tools'

export const plugin: Plugin = {
  toAst: (_, processor) => (node, ctx) => {
    if (typeof node !== 'string' && 'type' in node && 'content' in node && node.type === 'block') {
      const content = node.content[0]
      if (content && typeof content !== 'string' && 'location' in node && 'value' in content) {
        const lineOffset = node.location.start.line
        return { ...node, content: md2ast(content, { lineOffset }) }
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
