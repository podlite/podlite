import * as path from 'path'
import { getFromTree } from '@podlite/schema'
import { assembleIncludes, podlite, readerFor } from 'podlite'
import type { IncludeProblem } from 'podlite'
import { publishRecord } from './record'
import { PodliteWebPlugin, PodliteWebPluginContext } from './plugins'
import { catalogueOf, idOfFile } from './catalogue'

export type IncludeResolveOptions = {
  // the records the site read before the plugins ran, mounted sources among them:
  // what an include can bring
  catalogue?: publishRecord[]
  // directories a path written inside one of them does not lead out of
  bounds?: string[]
}

// Where a problem was met: the directive it was found at, its file from the
// working directory when absolute.
export const describeProblem = (problem: IncludeProblem): string => {
  const at = problem.chain[problem.chain.length - 1]
  const line = at?.location ? `:${at.location.start.line}` : ''
  const file = at ? (path.isAbsolute(at.file) ? path.relative(process.cwd(), at.file) : at.file) : '<document>'
  return `${file}${line}: ${problem.message}`
}

const say = (problem: IncludeProblem) => console.warn(`[plugin: resolve ] ${describeProblem(problem)}`)

// The blocks an include finds take the place of the directive, read from the
// text of their source with the settings in effect where the directive stands.
const plugin = (options: IncludeResolveOptions = {}): PodliteWebPlugin => {
  const outCtx: PodliteWebPluginContext = {}
  const onExit = ctx => ({ ...ctx, ...outCtx })
  const read = readerFor(podlite({ importPlugins: true }))
  const catalogue = catalogueOf(options.catalogue ?? [], { bounds: options.bounds, parse: read })
  const onProcess = (recs: publishRecord[]) => {
    if (!options.catalogue) {
      console.warn(
        '[plugin: resolve ] no catalogue of the site is given; an include is looked for among the records at hand',
      )
    }
    // a document a plugin made on the way is a source too
    catalogue.add(recs)
    return recs.map(record => {
      if (!getFromTree(record.node, 'include').length) return record
      const self = catalogue.idOf(record)
      const node = assembleIncludes(record.node, {
        sources: catalogue.sources,
        context: path.dirname(self ?? idOfFile(record.file)),
        parse: read,
        file: record.file,
        self,
        reportCycles: true,
        onError: say,
        onWarning: say,
      })
      return { ...record, node }
    })
  }

  return [onProcess, onExit]
}
export default plugin
