import { Plugins, PodliteDocument, mkRootBlock, parseOpt, toAny, toAnyRules, toHtml, toTree } from '.'
import toMarkdown from './exportMarkdown'
import idMiddleware from './helpers/ids'
import core from './helpers/corePlugins'
import { propagateConfigDefaults, ConfigScope } from './helpers/configPropagation'
import { attachHeadingNumberPrefix } from './helpers/headingNumbering'
import { promoteOrderedLists } from './helpers/itemNumbering'
import { markGuarded } from './guard'
import { applyFoldedSections } from './folded-sections'
import { assignHeadingKeys } from './helpers/headingKeys'
import { placeInSource, lineStarts } from './codes/place'
export { cleanIds, frozenIds, headingId } from './helpers/ids'

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
export type ToAstOpt = {
  config?: ConfigScope
}
export interface Podlite {
  toAstResult: (ast: PodliteDocument, opt?: ToAstOpt) => PodliteExport
  (): any
  use: (plugin: Plugins) => Podlite
  parse: (text: string, opt?: parseOpt) => PodliteDocument
  toHtml: (ast: PodliteDocument) => PodliteExport
  toMarkdown: (ast: PodliteDocument) => PodliteExport
  toAst: (ast: PodliteDocument, opt?: ToAstOpt) => PodliteDocument
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
    const diagnostics = opt.diagnostics || []
    const rawTree = toTree()
      .use(idMiddleware)
      .parse(text, { ...opt, diagnostics })
    // a warning about a markup code knows its place in the text it was read from;
    // the source turns that into a place a reader can go to
    const placed = new Set<string>()
    let starts: number[] | null = null
    for (let k = 0; k < diagnostics.length; k++) {
      const d = diagnostics[k] as any
      if (!d.pending) continue
      starts = starts || lineStarts(text)
      d.location = placeInSource(text, d.location, d.pending, starts)
      // the same text read twice reports one warning for one place; two pieces of text
      // placed at the same point, such as cells of one row, keep their warnings apart
      const key = `${d.code}@${d.location.start.offset}@${d.pending.start}@${d.pending.fragment.text}`
      delete d.pending
      if (placed.has(key)) diagnostics.splice(k--, 1)
      else placed.add(key)
    }
    // one mistake inside a value reports twice: for the value and for the whole
    // attribute around it. The narrower report names the place to fix. Two reports of
    // one place keep the first; a warning about a markup code is about the code, not
    // a value, and stays
    const isCodeWarning = (d: { code: string }) => d.code.startsWith('markup-code-')
    const innermost = diagnostics.filter(
      (d, k) =>
        isCodeWarning(d) ||
        !diagnostics.some(
          (other, j) =>
            other !== d &&
            !isCodeWarning(other) &&
            other.location.start.offset >= d.location.start.offset &&
            other.location.end.offset <= d.location.end.offset &&
            (other.location.start.offset !== d.location.start.offset ||
              other.location.end.offset !== d.location.end.offset ||
              j < k),
        ),
    )
    diagnostics.splice(0, diagnostics.length, ...innermost)
    const root = mkRootBlock({ margin: '' }, rawTree)
    // the parse is the one place that has the text the keys are fingerprinted from
    assignHeadingKeys(root, text)
    return diagnostics.length ? { ...root, diagnostics } : root
  }

  instance.toAst = (ast, opt) => {
    return <PodliteDocument>instance.toAstResult(ast, opt).interator
  }

  instance.toAstResult = (ast, opt = {}) => {
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
      if (resultAfter && resultAfter.interator) {
        propagateConfigDefaults(resultAfter.interator, opt.config)
        promoteOrderedLists(resultAfter.interator)
        attachHeadingNumberPrefix(resultAfter.interator)
        markGuarded(resultAfter.interator)
        resultAfter.interator = applyFoldedSections(resultAfter.interator)
      }
      return resultAfter
    }

    if (result && result.interator) {
      propagateConfigDefaults(result.interator, opt.config)
      promoteOrderedLists(result.interator)
      attachHeadingNumberPrefix(result.interator)
      markGuarded(result.interator)
      result.interator = applyFoldedSections(result.interator)
    }
    return result
  }

  instance.toHtml = ast => {
    const toHtmlPlugins = toAnyRules('toHtml', instance.getPlugins())
    return toHtml({}).use(toHtmlPlugins).run(ast, null)
  }

  instance.toMarkdown = ast => {
    const toMarkdownPlugins = toAnyRules('toMarkdown', instance.getPlugins())
    return toMarkdown({}).use(toMarkdownPlugins).run(ast, null)
  }

  instance.getPlugins = () => _plugins

  // init core plugins
  instance.use(core)
  // init external plugins
  instance.use(plugins)
  return instance
}
