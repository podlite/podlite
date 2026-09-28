/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import PodliteEditor from '../src/Editor'
import type { IncludeSource, PodliteEditorRef } from '../src/Editor'

class NoResize {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(global as any).ResizeObserver = NoResize
;(global as any).IS_REACT_ACT_ENVIRONMENT = true
// the preview follows the cursor on a timer, and jsdom has nothing to scroll with
;(window.HTMLElement.prototype as any).scrollTo = () => {}

type Files = Record<string, string | null | Error>

// a source that answers on a later turn, and what it was asked
const later = (files: Files, masks: Record<string, string[] | Error> = {}) => {
  const asked: string[] = []
  const source: IncludeSource = {
    read: path =>
      new Promise((resolve, reject) => {
        asked.push(`read ${path}`)
        const answer = files[path] ?? null
        setTimeout(() => (answer instanceof Error ? reject(answer) : resolve(answer)), 1)
      }),
    expand: pattern =>
      new Promise((resolve, reject) => {
        asked.push(`expand ${pattern}`)
        const answer = masks[pattern] ?? []
        setTimeout(() => (answer instanceof Error ? reject(answer) : resolve(answer)), 1)
      }),
  }
  return { source, asked }
}

const settle = async () => {
  for (let i = 0; i < 8; i++) {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 3))
    })
  }
}

const mount = (element: React.ReactElement) => {
  const host = window.document.createElement('div')
  window.document.body.appendChild(host)
  const root = createRoot(host)
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  act(() => {
    root.render(element)
  })
  const said = () => warn.mock.calls.map(c => String(c[0])).filter(text => text.startsWith('[to-jsx]'))
  const preview = () => host.querySelector('.podlite-editor-preview')?.textContent ?? ''
  const done = () => {
    act(() => root.unmount())
    host.remove()
    warn.mockRestore()
  }
  return { root, preview, said, done }
}

const doc = '=begin pod\n\n=para Before\n\n=include file:p.podlite\n\n=end pod\n'

describe('a preview whose included files come from a source that answers later', () => {
  it('shows the document at once and the included content when it has come', async () => {
    const { source } = later({ 'p.podlite': '=para Included\n' })
    const view = mount(<PodliteEditor value={doc} includeSource={source} />)
    expect(view.preview()).toContain('Before')
    expect(view.preview()).not.toContain('Included')
    expect(view.said()).toEqual([])
    await settle()
    expect(view.preview()).toContain('Included')
    expect(view.said()).toEqual([])
    view.done()
  })

  it('asks for a file once, also when it is included twice and when what it includes comes later', async () => {
    const files = { 'p.podlite': '=para Included\n\n=include file:leaf.podlite\n', 'leaf.podlite': '=para Leaf\n' }
    const { source, asked } = later(files)
    const twice = '=begin pod\n\n=include file:p.podlite\n\n=include file:p.podlite\n\n=end pod\n'
    const view = mount(
      <React.StrictMode>
        <PodliteEditor value={twice} includeSource={source} />
      </React.StrictMode>,
    )
    await settle()
    expect(view.preview().match(/Leaf/g)?.length).toBe(2)
    expect(asked).toEqual(['read p.podlite', 'read leaf.podlite'])
    view.done()
  })

  it('lists the headings of an included file in a table of contents once it has come', async () => {
    const { source } = later({ 'p.podlite': '=head1 Chapter\n' })
    const text = '=begin pod\n\n=toc head1\n\n=head1 Book\n\n=include file:p.podlite\n\n=end pod\n'
    const view = mount(<PodliteEditor value={text} includeSource={source} />)
    await settle()
    expect(view.preview().match(/Chapter/g)?.length).toBe(2)
    view.done()
  })

  it('expands a mask through the source, and takes a mask that names nothing', async () => {
    const { source, asked } = later(
      { 'a.podlite': '=para A\n', 'b.podlite': '=para B\n' },
      { '*.podlite': ['a.podlite', 'b.podlite'] },
    )
    const text = '=begin pod\n\n=include file:*.podlite\n\n=include file:no*.podlite\n\n=para After\n\n=end pod\n'
    const view = mount(<PodliteEditor value={text} includeSource={source} />)
    await settle()
    expect(view.preview()).toContain('A')
    expect(view.preview()).toContain('B')
    expect(asked.filter(q => q.startsWith('expand'))).toEqual(['expand *.podlite', 'expand no*.podlite'])
    expect(view.said()).toEqual([])
    view.done()
  })

  it('says once why a file could not be read and why a mask could not be expanded', async () => {
    const { source } = later({ 'p.podlite': new Error('denied') }, { '*.podlite': new Error('glob down') })
    const text = '=begin pod\n\n=include file:p.podlite\n\n=include file:*.podlite\n\n=end pod\n'
    const view = mount(<PodliteEditor value={text} includeSource={source} />)
    await settle()
    expect(view.said().sort()).toEqual([
      '[to-jsx] include mask cannot be expanded: *.podlite: glob down',
      '[to-jsx] include target cannot be read: p.podlite: denied',
    ])
    view.done()
  })

  it('says that a file is not there when the source answers so', async () => {
    const { source } = later({})
    const view = mount(<PodliteEditor value={doc} includeSource={source} />)
    await settle()
    expect(view.said()).toEqual(['[to-jsx] include is not resolved: file:p.podlite'])
    view.done()
  })

  it('asks again for a file it was told to forget', async () => {
    const files: Files = { 'p.podlite': '=para First\n' }
    const { source, asked } = later(files)
    const ref = React.createRef<PodliteEditorRef>()
    const view = mount(<PodliteEditor ref={ref} value={doc} includeSource={source} />)
    await settle()
    files['p.podlite'] = '=para Second\n'
    act(() => ref.current?.invalidateIncludes('p.podlite'))
    await settle()
    expect(view.preview()).toContain('Second')
    expect(asked).toEqual(['read p.podlite', 'read p.podlite'])
    view.done()
  })

  it('drops an answer that comes after the file was forgotten', async () => {
    let release: (text: string) => void = () => {}
    const asked: string[] = []
    const source: IncludeSource = {
      read: path =>
        new Promise(resolve => {
          asked.push(path)
          if (asked.length === 1) release = resolve
          else setTimeout(() => resolve('=para Fresh\n'), 1)
        }),
    }
    const ref = React.createRef<PodliteEditorRef>()
    const view = mount(<PodliteEditor ref={ref} value={doc} includeSource={source} />)
    await settle()
    act(() => ref.current?.invalidateIncludes('p.podlite'))
    await settle()
    await act(async () => release('=para Stale\n'))
    await settle()
    expect(view.preview()).toContain('Fresh')
    expect(view.preview()).not.toContain('Stale')
    view.done()
  })

  it('drops the answers of a source that was taken away', async () => {
    const first = later({ 'p.podlite': '=para First\n' })
    const second = later({ 'p.podlite': '=para Second\n' })
    const view = mount(<PodliteEditor value={doc} includeSource={first.source} />)
    act(() => view.root.render(<PodliteEditor value={doc} includeSource={second.source} />))
    await settle()
    expect(view.preview()).toContain('Second')
    expect(view.preview()).not.toContain('First')
    view.done()
  })

  it('leaves a reader that answers at once as it was', () => {
    const view = mount(<PodliteEditor value={doc} includeReader={() => '=para Included\n'} />)
    expect(view.preview()).toContain('Included')
    view.done()
  })

  it('takes no answer after it is gone', async () => {
    const { source } = later({ 'p.podlite': '=para Included\n' })
    const error = jest.spyOn(console, 'error').mockImplementation(() => {})
    const view = mount(<PodliteEditor value={doc} includeSource={source} />)
    view.done()
    await new Promise(resolve => setTimeout(resolve, 10))
    const complaints = error.mock.calls.length
    error.mockRestore()
    expect(complaints).toBe(0)
  })
})
