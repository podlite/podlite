import { Plugins } from '@podlite/schema';
import {Plugin} from '@podlite/schema'
import { md2ast } from './tools';
  
export const plugin:Plugin =({
    toAst: (_, processor) => (node, ctx) => {
        if (typeof node !== "string" && 'type' in node && 'content' in node && node.type === 'block') {
            
            const content = node.content[0]
            if (content && typeof content !== "string" && 'location' in node && 'value' in content) {
                return md2ast(content.value) 
            }
            return node
        }

     },
    })
export const PluginRegister:Plugins = {
    Markdown: plugin
}
export default plugin


