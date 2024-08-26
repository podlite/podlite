import { getFromTree, makeAttrs, makeInterator, PodliteDocument, PodNode } from '@podlite/schema'
export type pubRecord = {
  type: string
  pubdate: string // '2024-08-02T12:34:56Z' ISO 8601, 'Tue, 02 Aug 2024 12:34:56 GMT' RFC 2822
  node: PodNode
  description?: PodNode
  file: string
}

export type publishRecord = pubRecord & {
  title: string | null
  publishUrl: string
  sources: string[]
  node: PodliteDocument
  pubdate: string | undefined
}

export interface PodliteWebPluginContext {
  [name: string]: any
}
export type PodliteWebPlugin = [
  (rects: publishRecord[]) => publishRecord[],
  (ctx: PodliteWebPluginContext) => { [name: string]: any },
]
export interface PluginConfig {
  name?: string
  plugin: PodliteWebPlugin
  includePatterns?: string | string[]
  excludePatterns?: string | string[]
}

// Config file
interface Config {
  plugins: PluginConfig[]
}

/**
=begin pod
=head1 filterFiles

This function filters an array of file names based on provided include and exclude patterns. It first converts the includePatterns and excludePatterns arguments into arrays, if they aren't already. The function then filters through the files array, including a file if it matches any of the include patterns (or if no include patterns are provided) and excluding it if it matches any of the exclude patterns. The function returns a new array containing the files that match the include criteria and do not match the exclude criteria.

=head2 Parameters

  =begin item
  B<files>
  
  An array of strings, each representing a file name to be filtered.
  =end item
  =begin item
  B<includePatterns>
  
  Optional. A string or an array of strings representing the pattern(s) files must match to be included. If not provided, all files are considered to match the include criteria.
  =end item
  =begin item
  B<excludePatterns>
  
  Optional. A string or an array of strings representing the pattern(s) files must match to be excluded. If not provided, no files are excluded based on patterns.
  =end item

=head2 Returns

An array of strings, each representing a file name that matched the include criteria and did not match the exclude criteria.

=end pod
*/
export function filterFiles(
  files: string[],
  includePatterns?: string | string[],
  excludePatterns?: string | string[],
): string[] {
  const patternArray = includePatterns ? (Array.isArray(includePatterns) ? includePatterns : [includePatterns]) : ['.*']
  const excludePatternArray = excludePatterns
    ? Array.isArray(excludePatterns)
      ? excludePatterns
      : [excludePatterns]
    : []

  return files.filter(file => {
    const include = patternArray.length === 0 ? true : patternArray.some(pattern => new RegExp(pattern).test(file))
    const exclude =
      excludePatternArray.length === 0 ? false : excludePatternArray.some(pattern => new RegExp(pattern).test(file))
    return include && !exclude
  })
}

/**
=begin pod
=head1 processPlugin

The function `processPlugin` processes a collection of publishing records based on a given 
plugin configuration. It filters the items to determine which ones match specified inclusion 
and exclusion patterns. Items that match are processed by the provided plugin function, while
 items that do not match are passed through unchanged. Finally, it returns a tuple containing 
 the processed items and the result of calling the `onClose` function with a context object.

=head2 Parameters

  =begin item
  B<pluginConf>
  
  An object of type `PluginConfig` that provides configuration for the plugin, including 
  the plugin processing function, inclusion patterns, and exclusion patterns.
  =end item
  =begin item
  B<items>
  
  An array of `publishRecord` objects representing the items to be processed by the plugin.
  =end item

=head2 Returns

A tuple where the first element is an array of `publishRecord` objects representing 
the processed and unprocessed items, and the second element is an object resulting 
from calling the plugin's `onClose` function with a context object. This object may 
contain arbitrary data based on the plugin's implementation.

=end pod
*/
export const processPlugin = (
  pluginConf: PluginConfig,
  items: publishRecord[],
  ctx: { [name: string]: any } = {},
): [publishRecord[], { [name: string]: any }] => {
  const [processItems, onClose] = pluginConf.plugin
  // process items
  const allPaths = items.map(i => i.file)
  const matchedPaths = filterFiles(allPaths, pluginConf.includePatterns || '.*', pluginConf.excludePatterns || [])
  const matchedItems = items.filter(i => matchedPaths.includes(i.file))
  const notMatchedPaths = allPaths.filter(i => !matchedPaths.includes(i))
  const notMatchedItems = items.filter(i => notMatchedPaths.includes(i.file))
  const nextState = [...notMatchedItems, ...processItems(matchedItems)]
  return [nextState, onClose(ctx)]
}

/**
=begin pod
=head1 composePlugins

This function takes an array of PluginConfig objects and combines them into a single PluginConfig.
It does this by sequentially processing each PluginConfig in the array with the next, 
effectively composing their behaviors into a single plugin configuration. 
Each PluginConfig is expected to modify a shared state and context. The composition 
is achieved by chaining the plugin functions within each PluginConfig, so that the 
output (both state and context) of one plugin function becomes the input to the next.

=head2 Parameters

  =begin item
  B<configs>
  
  An array of PluginConfig objects. Each PluginConfig is an object that represents 
  configuration for a plugin, which includes a plugin processing function and 
  potentially other settings.
  =end item

=head2 Returns

Returns a single PluginConfig object that represents the composed configuration 
of all the PluginConfig objects passed in the 'configs' array. This resulting 
PluginConfig can be used to process items with the combined logic of all the 
plugins defined in the input array.

=end pod
*/
export const composePlugins = (configs: PluginConfig[], inintCtx = {}): PluginConfig => {
  const result = configs.reduce(
    (acc, config) => {
      if (acc.config?.plugin) {
        const accCtx = acc.ctx || {}
        let resultCtx = {}
        const resultConfig: PluginConfig = {
          plugin: [
            items => {
              const [processedAccState, processedAccCtx] = processPlugin(acc.config, items, accCtx)
              const [processedState, processedCtx] = processPlugin(config, processedAccState, {
                ...accCtx,
                ...processedAccCtx,
              })
              resultCtx = { ...accCtx, ...processedAccCtx, ...processedCtx }
              return processedState
            },
            () => {
              return { ...accCtx, ...resultCtx }
            },
          ],
        }
        return { config: resultConfig, ctx: resultCtx }
      } else {
        return { config, ctx: inintCtx }
      }
    },
    { config: {} as PluginConfig, ctx: {} },
  )
  return result.config
}
