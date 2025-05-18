import { Plugins, PodliteDocument, mkRootBlock, parseOpt, toAny, toAnyRules, toHtml, toTree } from '.'
import idMiddleware from './helpers/ids'
import core from './helpers/corePlugins'
export { cleanIds, frozenIds } from './helpers/ids'

export interface podlitePluggableOpt {
  plugins?: Plugins
}

export interface PodliteExport {
  errors: any
  toString: () => string
  valueOf: () => string
  indexingTerms: any
  annotations: any
  defenitions: any
  interator: any
}
export interface Podlite {
  toAstResult: (ast: PodliteDocument) => PodliteExport
  (): any
  use: (plugin: Plugins) => Podlite
  parse: (text: string, opt?: parseOpt) => PodliteDocument
  toHtml: (ast: PodliteDocument) => PodliteExport
  toAst: (ast: PodliteDocument) => PodliteDocument
  getPlugins: () => Array<Plugins>
}

export const podlitePluggable: (params?: podlitePluggableOpt) => Podlite = ({ plugins = {} } = {}) => {
  let instance = <Podlite>function () {}
  let _plugins: Plugins[] = []

  instance.use = (onj: Plugins) => {
    for (const plugin of Object.entries(onj)) {
      const [key, val] = plugin
      if (typeof val === 'function') {
        _plugins.push({ [key]: { toAst: val } })
      } else {
        _plugins.push({ [key]: val })
      }
    }
    return instance
  }

  instance.parse = (text, opt: parseOpt = { skipChain: 0, podMode: 1 }) => {
    const rawTree = toTree().use(idMiddleware).parse(text, opt)
    const root = mkRootBlock({ margin: '' }, rawTree)
    return root
  }

  instance.toAst = ast => {
    return <PodliteDocument>instance.toAstResult(ast).interator
  }

  instance.toAstResult = ast => {
    // get plugins  for Ast
    const toAstPlugins = toAnyRules('toAst', instance.getPlugins())
    const result: PodliteExport = toAny()
      .use({
        '*': () => (node, ctx, interator) => {
          if ('content' in node) {
            node.content = interator(node.content, ctx)
          }
          return node
        },
      })
      .use(toAstPlugins)
      .run(ast)
    // add second pass
    const toAstAfterPlugins = toAnyRules('toAstAfter', instance.getPlugins())
    if (Object.keys(toAstAfterPlugins).length) {
      const resultAfter: PodliteExport = toAny()
        .use({
          '*': () => (node, ctx, interator) => {
            if ('content' in node) {
              node.content = interator(node.content, ctx)
            }
            return node
          },
        })
        .use(toAstAfterPlugins)
        .run(ast)
      return resultAfter
    }

    return result
  }

  instance.toHtml = ast => {
    const toHtmlPlugins = toAnyRules('toHtml', instance.getPlugins())
    return toHtml({}).use(toHtmlPlugins).run(ast, null)
  }

  instance.getPlugins = () => _plugins

  // init core plugins
  instance.use(core)
  // init external plugins
  instance.use(plugins)
  return instance
}
