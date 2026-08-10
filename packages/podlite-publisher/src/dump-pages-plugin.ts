import { BUILT_PATH } from './constants'
import * as fs from 'fs'
import { PodliteWebPlugin, PodliteWebPluginContext, publishRecord, streamWriteLines } from '.'

interface dumpPagesPluginInitParams {
  built_path: string // built path
}
const plugin = ({ built_path = BUILT_PATH }: dumpPagesPluginInitParams): PodliteWebPlugin => {
  let allRecords: publishRecord[] = []

  const outCtx: PodliteWebPluginContext = {}
  const onExit = ctx => {
    if (!ctx.testing) {
      // records go out one per line, and the light index next to them carries where
      // each line starts: a reader needs the whole index but only one record
      streamWriteLines(allRecords, `${built_path}/pages.jsonl`)
        .then(places => {
          // named fields only: leaving out the heavy ones by name lets the next heavy
          // field slip in unnoticed, and one of them held 99 per cent of the weight
          const index = allRecords.map((r: any, i) => ({
            publishUrl: r.publishUrl,
            title: r.title,
            subtitle: r.subtitle,
            type: r.type,
            file: r.file,
            sources: r.sources,
            pubdate: r.pubdate,
            template_file: r.template_file,
            ...places[i],
          }))
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
