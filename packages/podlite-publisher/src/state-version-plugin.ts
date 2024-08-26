import * as CRC32 from 'crc-32'
import { getTextContentFromNode } from '@podlite/schema'
import { PodliteWebPlugin, PodliteWebPluginContext, publishRecord } from '.'
const version = require('../package.json').version
const plugin = (): PodliteWebPlugin => {
  const outCtx: PodliteWebPluginContext = {}
  let crc_sum = ''
  const onExit = ctx => {
    outCtx.stateVersion = CRC32.str(crc_sum) + '+v' + version
    return { ...ctx, ...outCtx }
  }
  const getStateVersion = (allREcords): string => {
    return allREcords.reduce((prev, current) => {
      return prev + CRC32.str(getTextContentFromNode(current.node))
    }, '')
  }
  const onProcess = (recs: publishRecord[]) => {
    crc_sum += getStateVersion(recs)
    return recs
  }

  return [onProcess, onExit]
}

export default plugin
