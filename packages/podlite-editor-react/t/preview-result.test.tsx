/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import PodliteEditor from '../src/Editor'

class NoResize {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Reflect.set(global, 'ResizeObserver', NoResize)
Reflect.set(global, 'IS_REACT_ACT_ENVIRONMENT', true)

const previewOf = (result: React.ReactElement | string): HTMLElement => {
  const host = window.document.createElement('div')
  window.document.body.appendChild(host)
  const root = createRoot(host)
  act(() => {
    root.render(<PodliteEditor value="=para x" enablePreview={true} makePreviewComponent={() => ({ result })} />)
  })
  const content = host.querySelector('.content')
  const html = content ? content.innerHTML : ''
  act(() => root.unmount())
  host.remove()
  const holder = window.document.createElement('div')
  holder.innerHTML = html
  return holder
}

describe('the preview of the editor', () => {
  it('draws an element the converter returns as an element', () => {
    expect(previewOf(<b className="element">E</b>).querySelector('b.element')?.textContent).toBe('E')
  })

  it('draws a string the converter returns as html', () => {
    expect(previewOf('<i class="markup">S</i>').querySelector('i.markup')?.textContent).toBe('S')
  })
})
