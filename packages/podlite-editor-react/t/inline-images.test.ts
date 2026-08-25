/**
 * @jest-environment jsdom
 */
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { podliteImages, imageLineOf, forgetResolvedImages } from '../src/imageDecorations'

const render = (doc: string, display: Parameters<typeof podliteImages>[0]): HTMLElement => {
  const state = EditorState.create({ doc, extensions: [podliteImages(display)] })
  const view = new EditorView({ state, parent: document.body })
  const dom = view.dom.cloneNode(true) as HTMLElement
  view.destroy()
  return dom
}

const shown = (dom: HTMLElement) => dom.querySelectorAll('.cm-pod-image')

// the resolver answers in a microtask, so the view has to stay alive to see it
const open = (doc: string, display: Parameters<typeof podliteImages>[0]): EditorView => {
  const state = EditorState.create({ doc, extensions: [podliteImages(display)] })
  return new EditorView({ state, parent: document.body })
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0))
const addressOf = (view: EditorView) => view.dom.querySelector('.cm-pod-image img')?.getAttribute('src')

beforeEach(() => forgetResolvedImages())

describe('the line that names a picture', () => {
  it('is recognised in its abbreviated form', () => {
    expect(imageLineOf('=Image photo.png')).toBe('photo.png')
    expect(imageLineOf('=picture ./media/shot.jpg')).toBe('./media/shot.jpg')
  })

  it('is recognised written as a paragraph block', () => {
    expect(imageLineOf('=for Image photo.png')).toBe('photo.png')
  })

  it('is not confused with prose that mentions one', () => {
    expect(imageLineOf('The picture photo.png sits here')).toBeNull()
    expect(imageLineOf('=head1 Image handling')).toBeNull()
  })
})

describe('showing the picture in the body', () => {
  it('stays out of the way while the option is off', () => {
    const dom = render('=Image photo.png\n', { show: false })
    expect(shown(dom)).toHaveLength(0)
  })

  it('puts the picture under the line that names it', () => {
    const dom = render('=Image photo.png\n', { show: true })
    expect(shown(dom)).toHaveLength(1)
    expect(dom.querySelector('.cm-pod-image img')?.getAttribute('src')).toBe('photo.png')
  })

  it('shows one for every line that names a picture', () => {
    const dom = render('=Image one.png\n\ntext\n\n=picture two.jpg\n', { show: true })
    expect(shown(dom)).toHaveLength(2)
  })

  it('leaves a document naming no picture untouched', () => {
    const dom = render('=head1 Title\n\nplain prose\n', { show: true })
    expect(shown(dom)).toHaveLength(0)
  })

  it('waits quietly while the host resolves the address', () => {
    const dom = render('=Image photo.png\n', { show: true, resolve: () => new Promise(() => undefined) })
    const box = dom.querySelector('.cm-pod-image')
    expect(box?.classList.contains('cm-pod-image-waiting')).toBe(true)
    expect(box?.textContent).toBe('photo.png')
  })

  it('keeps two editors apart when one address sits in two directories', async () => {
    const under = (baseDir: string) =>
      open('=Image photo.png\n', { show: true, baseDir, resolve: (src, dir) => `${dir}/${src}` })
    const first = under('/docs/a')
    await settle()
    const second = under('/docs/b')
    await settle()
    expect(addressOf(first)).toBe('/docs/a/photo.png')
    expect(addressOf(second)).toBe('/docs/b/photo.png')
    first.destroy()
    second.destroy()
  })

  it('hands the address and the base directory to the host', () => {
    const asked: Array<[string, string | undefined]> = []
    render('=Image photo.png\n', {
      show: true,
      baseDir: '/docs',
      resolve: (src, baseDir) => {
        asked.push([src, baseDir])
        return src
      },
    })
    expect(asked).toEqual([['photo.png', '/docs']])
  })
})
