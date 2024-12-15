import { BUILT_PATH } from './constants'
import { PodliteWebPlugin, PodliteWebPluginContext, publishRecord, streamWriteArray } from '.'

interface dumpPagesPluginInitParams {
  built_path: string // built path
}
const plugin = ({ built_path = BUILT_PATH }: dumpPagesPluginInitParams): PodliteWebPlugin => {
  let allRecords: publishRecord[] = []

  const outCtx: PodliteWebPluginContext = {}
  const onExit = ctx => {
    if (!ctx.testing) {
      streamWriteArray(allRecords, `${built_path}/pages.json`)
        .then(() => console.log('All pages written successfully'))
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
