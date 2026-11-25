import * as CRC32 from 'crc-32'
import * as fs from 'fs'
import pathFs from 'path'
import { getFromTree, getTextContentFromNode, makeAttrs } from '@podlite/schema'
import { publishRecord } from './record'
import { PodliteWebPlugin, PodliteWebPluginContext } from './plugins'
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
  const isFile = (path: string): boolean => {
    try {
      return fs.statSync(path).isFile()
    } catch {
      return false
    }
  }
  // the pictures of each record in order, as the images plugin read them; without
  // it, the files it found
  const getImagesVersion = (ctx): string =>
    Array.isArray(ctx.imageSources)
      ? ctx.imageSources
          .map(
            ({ file, kind, address }) =>
              `${CRC32.str(`${file}\u0000${kind}\u0000${address}`)}` +
              (kind === 'local' && isFile(address) ? `${CRC32.buf(new Uint8Array(fs.readFileSync(address)))}` : ''),
          )
          .join('')
      : ''
  const getAssetPaths = (ctx): string[] => {
    const paths: string[] = Array.isArray(ctx.imageSources) ? [] : Object.keys(ctx.imagesMap || {})
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
      return prev + (isFile(path) ? CRC32.buf(new Uint8Array(fs.readFileSync(path))) : CRC32.str(path))
    }, getImagesVersion(ctx))
  }
  const onProcess = (recs: publishRecord[]) => {
    crc_sum += getStateVersion(recs)
    records.push(...recs)
    return recs
  }

  return [onProcess, onExit]
}

export default plugin
