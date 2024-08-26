import { PodliteWebPlugin, PodliteWebPluginContext, publishRecord } from '.'

const plugin = (): PodliteWebPlugin => {
  const outCtx: PodliteWebPluginContext = {}
  const onExit = ctx => ({ ...ctx, ...outCtx })
  const onProcess = (recs: publishRecord[]) => {
    return recs
  }

  return [onProcess, onExit]
}

export default plugin
