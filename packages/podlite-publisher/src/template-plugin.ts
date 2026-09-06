import { publishRecord } from './record'
import { PodliteWebPlugin, PodliteWebPluginContext } from './plugins'
const plugin = (): PodliteWebPlugin => {
  const outCtx: PodliteWebPluginContext = {}
  const onExit = ctx => ({ ...ctx, ...outCtx })
  const onProcess = (recs: publishRecord[]) => {
    return recs
  }

  return [onProcess, onExit]
}

export default plugin
