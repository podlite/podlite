import { processFile } from '../src/node-utils'
import { processPlugin } from '../src'
import imagesPlugin from '../src/images-plugin'
import { toHtml, toMarkdown } from '@podlite/schema'
import * as fs from 'fs'
import * as os from 'os'
import pathMod from 'path'

const tctx = { testing: true }

describe('a picture with a scheme in its address', () => {
  const run = (body: string, file = '/site/posts/probe.podlite') => {
    const record = processFile(file, `=begin pod\n${body}\n=end pod\n`)
    const [res, ctx] = processPlugin({ plugin: imagesPlugin(), includePatterns: '.*' }, [record], tctx)
    const images: any[] = []
    const walk = (node: any) => {
      if (Array.isArray(node)) return node.forEach(walk)
      if (!node || typeof node !== 'object') return
      if (node.type === 'image') images.push(node)
      if (node.content && typeof node.content === 'object') walk(node.content)
    }
    walk(res[0].node)
    return { node: res[0].node, images, map: ctx.imagesMap, sources: ctx.imageSources }
  }
  const html = (node: any) => toHtml({}).run(node).toString()
  const markdown = (node: any) => toMarkdown({}).run(node).toString()

  it('keeps a remote address as written and copies no file for it', () => {
    for (const body of [
      '=for picture :src<https://example.com/image.jpg>\n',
      '=para P<alt|https://example.com/image.jpg>\n',
    ]) {
      const { node, images, map } = run(body)
      expect(images.map(i => i.src)).toEqual(['https://example.com/image.jpg'])
      expect(map).toEqual({})
      expect(html(node)).toContain('src="https://example.com/image.jpg"')
      expect(markdown(node)).toContain('(https://example.com/image.jpg)')
    }
  })

  it('keeps the remote address of a Markdown image', () => {
    const record = processFile('/site/posts/probe.md', '![alt](https://example.com/image.jpg)\n')
    const [res, ctx] = processPlugin({ plugin: imagesPlugin(), includePatterns: '.*' }, [record], tctx)
    expect(ctx.imagesMap).toEqual({})
    expect(JSON.stringify(res[0].node)).toContain('"type":"image","src":"https://example.com/image.jpg"')
  })

  it('reads file:/path as the path, and keeps the option the author wrote', () => {
    const uri = run('=for picture :src<file:/local/image.png>\n')
    const path = run('=for picture :src</local/image.png>\n')
    expect(uri.map).toEqual(path.map)
    expect(Object.keys(uri.map)).toEqual(['/local/image.png'])
    expect(uri.images).toEqual(path.images)
    expect(html(uri.node).replace(/ id="[^"]*"/g, '')).toEqual(html(path.node).replace(/ id="[^"]*"/g, ''))
    expect(markdown(uri.node)).toEqual(markdown(path.node))
    expect(JSON.stringify(uri.node)).toContain('"value":"file:/local/image.png"')
  })

  it('imports the file a file: URI with %20 names', () => {
    const dir = fs.mkdtempSync(pathMod.join(os.tmpdir(), 'images-uri-'))
    const file = pathMod.join(dir, 'a b.png')
    fs.writeFileSync(file, 'x')
    try {
      const { map } = run(`=for picture :src<file://${encodeURI(file)}>\n`)
      expect(Object.keys(map)).toEqual([file])
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
