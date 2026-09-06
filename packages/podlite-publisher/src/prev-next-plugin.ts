import { isEntry, publishRecord } from './record'
import { PodliteWebPlugin, PodliteWebPluginContext } from './plugins'
const plugin = (): PodliteWebPlugin => {
  const outCtx: PodliteWebPluginContext = {}
  const onExit = ctx => ({ ...ctx, ...outCtx })
  const onProcess = (recs: publishRecord[]) => {
    const notPages = recs.filter(isEntry)
    recs.forEach(item => {
      if (item.publishUrl) {
        const allData = (isEntry(item) ? notPages : recs).filter(({ publishUrl }) => Boolean(publishUrl))
        const articleIndex = allData.findIndex(({ publishUrl }) => publishUrl === item.publishUrl)
        const prepareReference = (item: publishRecord): any | boolean => {
          if (item) {
            const { pluginsData, node, ...rest } = item
            return rest
          }
          return false
        }
        const prev = prepareReference(allData[articleIndex - 1])
        const next = prepareReference(allData[articleIndex + 1])
        //

        const navigate = { prev, next }
        item.pluginsData = item.pluginsData || {}
        item.pluginsData.navigate = navigate
      }
    })

    return recs
  }

  return [onProcess, onExit]
}

export default plugin
