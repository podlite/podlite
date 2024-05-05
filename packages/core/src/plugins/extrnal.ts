import { Plugins } from '@podlite/schema'
import { PluginRegister } from '@podlite/image'
import { PluginRegister as DiagramRegister } from '@podlite/diagram'
import { PluginRegister as MarkdownRegister } from '@podlite/markdown'
import { PluginRegister as TocRegister } from '@podlite/toc'
import { PluginRegister as FomulaRegister } from '@podlite/formula'
const external: Plugins = {
  ...DiagramRegister,
  ...MarkdownRegister,
  ...PluginRegister,
  ...TocRegister,
  ...PluginRegister,
  ...FomulaRegister,
}

export default external
