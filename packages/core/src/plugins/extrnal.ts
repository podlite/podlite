import { Plugins } from '@podlite/schema'
import { PluginRegister } from '@podlite/image'
import { PluginRegister as DiagramRegister } from '@podlite/diagram'
import { PluginRegister as MarkdownRegister } from '@podlite/markdown'
import { PluginRegister as TocRegister } from '@podlite/toc'
const external: Plugins = {
  ...DiagramRegister,
  ...MarkdownRegister,
  ...PluginRegister,
  ...TocRegister,
}

export default external
