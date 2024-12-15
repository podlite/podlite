import { PodliteWebPlugin, publishRecord } from '.'

interface docsInjectorPluginInitParams {
  docs: publishRecord[]
}
const plugin = ({ docs = [] }: docsInjectorPluginInitParams): PodliteWebPlugin => {
  const onExit = ctx => {
    return { ...ctx }
  }
  const onProcess = (recs: publishRecord[]) => {
    return [...recs, ...docs]
  }

  return [onProcess, onExit]
}

export default plugin
