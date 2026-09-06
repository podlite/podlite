import { BUILT_PATH } from './constants'
import * as fs from 'fs'
import { publishRecord } from './record'
import { PodliteWebPlugin, PodliteWebPluginContext } from './plugins'
import { streamWriteLines } from './node-utils'
interface dumpPagesPluginInitParams {
  built_path: string // built path
  indexFields?: string[] // small record fields the site wants in the index
}

// named fields only: leaving out the heavy ones by name lets the next heavy
// field slip in unnoticed, and one of them held 99 per cent of the weight
export const buildPagesIndex = (records: publishRecord[], places: object[], indexFields: string[] = []) =>
  records.map((r: any, i) => ({
    publishUrl: r.publishUrl,
    title: r.title,
    subtitle: r.subtitle,
    type: r.type,
    isPage: r.isPage,
    file: r.file,
    sources: r.sources,
    pubdate: r.pubdate,
    template_file: r.template_file,
    ...Object.fromEntries(indexFields.map(name => [name, r[name]])),
    ...places[i],
  }))

const plugin = ({ built_path = BUILT_PATH, indexFields }: dumpPagesPluginInitParams): PodliteWebPlugin => {
  let allRecords: publishRecord[] = []

  const outCtx: PodliteWebPluginContext = {}
  const onExit = ctx => {
    if (!ctx.testing) {
      // records go out one per line, and the light index next to them carries where
      // each line starts: a reader needs the whole index but only one record
      streamWriteLines(allRecords, `${built_path}/pages.jsonl`)
        .then(places => {
          const index = buildPagesIndex(allRecords, places, indexFields)
          fs.writeFileSync(`${built_path}/pages-index.json`, JSON.stringify(index))
          console.log(`All pages written successfully: ${index.length}`)
        })
        .catch(err => console.error('Error writing file:', err))
    }
    return { ...ctx, ...outCtx }
  }
  const onProcess = (recs: publishRecord[]) => {
    allRecords.push(...recs)
    return [...recs]
  }

  return [onProcess, onExit]
}

export default plugin
