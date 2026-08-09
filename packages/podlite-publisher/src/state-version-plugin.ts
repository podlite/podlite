import * as CRC32 from 'crc-32'
import * as fs from 'fs'
import pathFs from 'path'
import { getFromTree, getTextContentFromNode, makeAttrs } from '@podlite/schema'
import { PodliteWebPlugin, PodliteWebPluginContext, publishRecord } from '.'
import { version } from './version'
const plugin = (appVersion?: string, indexFilePath?: string): PodliteWebPlugin => {
  const outCtx: PodliteWebPluginContext = {}
  let crc_sum = ''
  const records: publishRecord[] = []
  const onExit = ctx => {
    outCtx.stateVersion =
      CRC32.str(crc_sum + getAssetsVersion(ctx)) + '+v' + version + (appVersion ? '+app' + appVersion : '')
    return { ...ctx, ...outCtx }
  }
  const getStateVersion = (allREcords): string => {
    return allREcords.reduce((prev, current) => {
      return prev + CRC32.str(getTextContentFromNode(current.node))
    }, '')
  }
  const getAssetPaths = (ctx): string[] => {
    const paths: string[] = Object.keys(ctx.imagesMap || {})
    const indexPage = indexFilePath ? records.find(item => item.file === indexFilePath) : undefined
    if (indexPage) {
      const [pod] = getFromTree(indexPage.node, 'pod')
      const attr = makeAttrs(pod, {})
      const indexDir = pathFs.dirname(indexFilePath)
      for (const name of ['globalStyles', 'favicon']) {
        const value = attr.getFirstValue(name)
        if (value) {
          paths.push(pathFs.join(indexDir, value))
        }
      }
    }
    return paths
  }
  const getAssetsVersion = (ctx): string => {
    return getAssetPaths(ctx).reduce((prev, path) => {
      // a missing file contributes its path, so adding the file later moves the sum
      return prev + (fs.existsSync(path) ? CRC32.buf(new Uint8Array(fs.readFileSync(path))) : CRC32.str(path))
    }, '')
  }
  const onProcess = (recs: publishRecord[]) => {
    crc_sum += getStateVersion(recs)
    records.push(...recs)
    return recs
  }

  return [onProcess, onExit]
}

export default plugin
