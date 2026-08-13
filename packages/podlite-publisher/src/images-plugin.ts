import { makeInterator, PodNode } from '@podlite/schema'
import { ASSETS_PATH, IMAGE_LIB } from './constants'
import pathMod from 'path'
import * as fs from 'fs'
import { getPathToOpen } from './node-utils'
import { PodliteWebPlugin, PodliteWebPluginContext, publishRecord } from '.'

const ORIENTATION_TAG = 0x0112

export const readOrientation = (file: string): number | null => {
  let bytes: Buffer
  try {
    bytes = fs.readFileSync(file)
  } catch {
    return null
  }
  if (bytes.length < 4 || bytes.readUInt16BE(0) !== 0xffd8) return null
  let at = 2
  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff) return null
    const marker = bytes.readUInt16BE(at)
    const size = bytes.readUInt16BE(at + 2)
    if (marker === 0xffe1 && bytes.toString('ascii', at + 4, at + 8) === 'Exif') {
      const tiff = at + 10
      if (tiff + 8 > bytes.length) return null
      const little = bytes.toString('ascii', tiff, tiff + 2) === 'II'
      const u16 = (o: number) => (little ? bytes.readUInt16LE(o) : bytes.readUInt16BE(o))
      const u32 = (o: number) => (little ? bytes.readUInt32LE(o) : bytes.readUInt32BE(o))
      const dir = tiff + u32(tiff + 4)
      if (dir + 2 > bytes.length) return null
      const count = u16(dir)
      for (let i = 0; i < count; i++) {
        const entry = dir + 2 + i * 12
        if (entry + 12 > bytes.length) return null
        if (u16(entry) === ORIENTATION_TAG) return u16(entry + 8)
      }
      return null
    }
    at += 2 + size
  }
  return null
}

// the build reads the orientation of every image it imports and stops on a value
// outside 1..8; one such file in a corpus used to cost the whole site
const isReadable = (file: string): boolean => {
  const orientation = readOrientation(file)
  return orientation === null || (orientation >= 1 && orientation <= 8)
}

const plugin = (): PodliteWebPlugin => {
  const outCtx: PodliteWebPluginContext = {}
  const imagesMap = new Map()
  const onExit = ctx => {
    if (!ctx.testing) {
      // process Images
      let libFileContent = ''
      for (const key of imagesMap.keys()) {
        const variable_name = imagesMap.get(key)
        if (!fs.existsSync(key)) {
          continue
        }
        if (!isReadable(key)) {
          console.warn(`image skipped, its orientation is not a value the build can read: ${key}`)
          continue
        }
        libFileContent += `import ${variable_name} from "${key}"
export { ${variable_name} }
    `
      }
      libFileContent += `
export default {}
`
      fs.writeFileSync(IMAGE_LIB, libFileContent, 'utf8')
    }
    return { ...ctx, ...outCtx, ...{ imagesMap: Object.fromEntries(imagesMap) } }
  }
  const processNode = (node: PodNode, file: string) => {
    const rules = {
      ':image': node => {
        // process copy files to assets
        // '../assets/'
        const { path } = getPathToOpen(node.src, file)
        const { name, ext, dir } = pathMod.parse(path)
        const variable_name = 'i' + path.split('/').slice(1).join('_').replace(/\W+/g, '_').toLowerCase()
        const newFileName = `${variable_name}${ext}`
        const dstFilename = ASSETS_PATH + '/' + newFileName
        imagesMap.set(path, variable_name)

        return { ...node, src: variable_name }
      },
    }
    return makeInterator(rules)(node, {})
  }
  const onProcess = (recs: publishRecord[]) => {
    const res = recs.map(item => {
      const node = processNode(item.node, item.file)
      // process images inside description
      let extra = {} as { description?: PodNode }
      if (item.description) {
        extra.description = processNode(item.description, item.file)
      }

      return { ...item, node, ...extra }
    })
    return res
  }

  return [onProcess, onExit]
}

export default plugin
