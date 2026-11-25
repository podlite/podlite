import { processFile } from '../src/node-utils'
import { PluginConfig, processPlugin } from '../src'
import imagesPlugin, { readOrientation } from '../src/images-plugin'
import * as fs from 'fs'
import * as os from 'os'
import pathMod from 'path'

const tctx = { testing: true }
const file1 = `
=begin pod 
=Image open_and_browsing.mp4
=for picture :src<open_and_browsing.png>
=end pod
`

it('imagesPlugin: extract images', () => {
  const t1 = processFile('t/image-plugin/virtualFile.podlite', file1)
  const config: PluginConfig = {
    plugin: imagesPlugin(),
    includePatterns: '.*',
  }
  const [res, ctx] = processPlugin(config, [t1], tctx)
  expect(ctx).toMatchInlineSnapshot(`
    Object {
      "imagesMap": Object {
        "t/image-plugin/open_and_browsing.mp4": "iimage_plugin_open_and_browsing_mp4",
        "t/image-plugin/open_and_browsing.png": "iimage_plugin_open_and_browsing_png",
      },
      "testing": true,
    }
  `)
})

it('imagesPlugin: leaves a data: address out of the files to copy', () => {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC'
  const file = `
=begin pod
=for picture :src<data:Logo>

=para P<ready|DATA:image/png;base64,${png}>

=for picture :src<local.png>

=begin data :key<Logo> :mime-type<image/png> :encoding<base64>
${png}
=end data
=end pod
`
  const record = processFile('t/image-plugin/data.podlite', file)
  const [res, ctx] = processPlugin({ plugin: imagesPlugin(), includePatterns: '.*' }, [record], tctx)
  expect(Object.keys(ctx.imagesMap)).toEqual(['t/image-plugin/local.png'])
  const images: any[] = []
  const walk = (node: any) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== 'object') return
    if (node.type === 'image') images.push(node)
    if (node.content && typeof node.content === 'object') walk(node.content)
  }
  walk(res[0].node)
  expect(images.map(i => i.src)).toEqual(['data:Logo', `DATA:image/png;base64,${png}`, 'iimage_plugin_local_png'])
  expect(images[0].dataUrl).toBe(`data:image/png;base64,${png}`)
})

const jpegWithOrientation = (value: number): Buffer => {
  const tiff = Buffer.alloc(26)
  tiff.write('II', 0, 'ascii')
  tiff.writeUInt16LE(42, 2)
  tiff.writeUInt32LE(8, 4)
  tiff.writeUInt16LE(1, 8)
  tiff.writeUInt16LE(0x0112, 10)
  tiff.writeUInt16LE(3, 12)
  tiff.writeUInt32LE(1, 14)
  tiff.writeUInt16LE(value, 18)
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), Buffer.alloc(2), Buffer.from('Exif\0\0', 'ascii'), tiff])
  app1.writeUInt16BE(app1.length - 2, 2)
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app1, Buffer.from([0xff, 0xd9])])
}

const writeTemp = (name: string, body: Buffer): string => {
  const file = pathMod.join(os.tmpdir(), name)
  fs.writeFileSync(file, body)
  return file
}

describe('image orientation', () => {
  it('reads the value a photo declares', () => {
    expect(readOrientation(writeTemp('podlite-orientation-upright.jpg', jpegWithOrientation(1)))).toBe(1)
  })

  it('reads a value outside the range a build accepts', () => {
    expect(readOrientation(writeTemp('podlite-orientation-broken.jpg', jpegWithOrientation(0)))).toBe(0)
  })

  it('says nothing about a photo that declares no orientation', () => {
    const plain = Buffer.from([0xff, 0xd8, 0xff, 0xd9])
    expect(readOrientation(writeTemp('podlite-orientation-absent.jpg', plain))).toBeNull()
  })

  it('says nothing about a file that is not a photo', () => {
    expect(readOrientation(writeTemp('podlite-orientation-notjpeg.bin', Buffer.from('plain text')))).toBeNull()
  })
})
