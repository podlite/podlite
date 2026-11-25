import { makeInterator, PodNode } from '@podlite/schema'
import { ASSETS_PATH, IMAGE_LIB } from './constants'
import pathMod from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'
import { getPathToOpen } from './node-utils'
import { publishRecord } from './record'
import { PodliteWebPlugin, PodliteWebPluginContext } from './plugins'
import { nodeOrigin } from './source'
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

const isFile = (path: string): boolean => {
  try {
    return fs.statSync(path).isFile()
  } catch {
    return false
  }
}

// the build reads the orientation of every image it imports and stops on a value
// outside 1..8; one such file in a corpus used to cost the whole site
const isReadable = (file: string): boolean => {
  const orientation = readOrientation(file)
  return orientation === null || (orientation >= 1 && orientation <= 8)
}

export type ImageSource = { kind: 'remote' | 'data' | 'local'; path?: string }

/*
=begin pod :kind<export>

=head2 imageSourceOf

What the address of a picture names, read from the file it is written in: a
C<data:> address, a remote one (any scheme of two characters or more but C<file:>,
or an address that starts with C<//>), or a local file with its path. A C<file:>
address is a URI: one with a slash is read as a file URL, so C<%20> is a space; one
without a slash is a path from the file of the reference, decoded where it can be.
A C<file:> URI that names no local path, as one with a host, is left as written. An
address with no scheme is a path, as it always was.

=end pod
*/
export const imageSourceOf = (src: string, from: string): ImageSource => {
  if (/^data:/i.test(src)) return { kind: 'data' }
  const file = /^file:([\s\S]*)$/i.exec(src)
  if (file) {
    const rest = file[1]
    if (rest.startsWith('/')) {
      try {
        return { kind: 'local', path: fileURLToPath(`file:${rest}`) }
      } catch {
        return { kind: 'remote' }
      }
    }
    let decoded = rest
    try {
      decoded = decodeURIComponent(rest)
    } catch {}
    return { kind: 'local', path: pathMod.normalize(pathMod.join(pathMod.dirname(from), decoded)) }
  }
  if (/^[A-Za-z][A-Za-z0-9+.-]+:/.test(src) || src.startsWith('//')) return { kind: 'remote' }
  return { kind: 'local', path: getPathToOpen(src, from).path }
}

const plugin = (): PodliteWebPlugin => {
  const outCtx: PodliteWebPluginContext = {}
  const imagesMap = new Map()
  // every picture of every record in order, repeats too, for the version of the site;
  // a record is the page it publishes, as one file may give several notes
  const imageSources: Array<{ file: string; kind: string; address: string }> = []
  const onExit = ctx => {
    if (!ctx.testing) {
      // process Images
      let libFileContent = ''
      for (const key of imagesMap.keys()) {
        const variable_name = imagesMap.get(key)
        // only a file is imported: a path that names a directory, as file:/// does, is not
        if (!isFile(key)) {
          continue
        }
        if (!isReadable(key)) {
          console.warn(`image skipped, its orientation is not a value the build can read: ${key}`)
          continue
        }
        libFileContent += `import ${variable_name} from ${JSON.stringify(key)}
export { ${variable_name} }
    `
      }
      libFileContent += `
export default {}
`
      fs.writeFileSync(IMAGE_LIB, libFileContent, 'utf8')
    }
    return { ...ctx, ...outCtx, ...{ imagesMap: Object.fromEntries(imagesMap), imageSources } }
  }
  const processNode = (node: PodNode, file: string, record: string) => {
    const rules = {
      ':image': node => {
        if (typeof node.src !== 'string') return node
        // a picture an include brought is found from the file it was written in
        const source = imageSourceOf(node.src, nodeOrigin(node)?.file ?? file)
        const address = source.path ?? node.src
        imageSources.push({ file: record, kind: source.kind, address })
        // a data: or remote address is no file to copy
        if (source.kind !== 'local') return node
        const path = address
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
      const record = item.publishUrl ?? item.file
      const node = processNode(item.node, item.file, record)
      // process images inside description
      let extra = {} as { description?: PodNode }
      if (item.description) {
        extra.description = processNode(item.description, item.file, record)
      }

      return { ...item, node, ...extra }
    })
    return res
  }

  return [onProcess, onExit]
}

export default plugin
