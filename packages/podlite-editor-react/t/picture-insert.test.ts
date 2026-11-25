/**
 * @jest-environment jsdom
 */
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { insertPicture } from '../src/imagePasteHandler'
import { sourceOption } from '../src/pictureSource'
import dictionary from '../src/dict'
import { podlite } from 'podlite'

const inserted = (doc: string, path: string): string => {
  const view = new EditorView({ state: EditorState.create({ doc, selection: { anchor: doc.length } }) })
  insertPicture(view, path)
  const text = view.state.doc.toString()
  view.destroy()
  return text
}
const sourceOf = (text: string) => {
  const p = podlite({ importPlugins: true })
  const tree: any = p.toAst(p.parse(text, { podMode: 1 }))
  const picture = tree.content.find((node: any) => node.name === 'picture')
  return picture?.content[0]?.src
}

describe('a picture the editor writes', () => {
  it('names its source in :src, as =picture takes it', () => {
    expect(inserted('', 'media/shot.png')).toBe('=for picture :src<media/shot.png>\n')
    expect(sourceOf(inserted('', 'media/shot.png'))).toBe('media/shot.png')
  })

  it('writes a source with a space or an angle bracket so it reads back whole', () => {
    for (const path of ['media/a shot.png', 'media/a>b.png', "media/it's here.png"])
      expect(sourceOf(`${inserted('', path)}`)).toBe(path)
    expect(sourceOption('a b.png')).toBe(":src('a b.png')")
  })

  it('completes =picture with its source in :src', () => {
    const picture = dictionary.find((d: any) => d.displayText === 'picture 🏷')
    expect(picture?.text).toMatch(/^=for picture :src<#\{https:\/\/[^}]+\}>\n$/)
  })
})
