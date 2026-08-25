/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import PodliteEditor from '../src/Editor'
import { forgetResolvedImages } from '../src/imageDecorations'

// jsdom has no layout, and the editor watches its container for resizes
class NoResize {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(global as any).ResizeObserver = NoResize
;(global as any).IS_REACT_ACT_ENVIRONMENT = true

const doc = '=Image photo.png\n'

const host = () => {
  const node = window.document.createElement('div')
  window.document.body.appendChild(node)
  return node
}

beforeEach(() => forgetResolvedImages())

describe('the editor and the picture it is asked to show', () => {
  it('shows nothing until the option is turned on', () => {
    const node = host()
    const root = createRoot(node)
    act(() => {
      root.render(<PodliteEditor value={doc} showInlineImages={false} />)
    })
    expect(node.querySelectorAll('.cm-pod-image')).toHaveLength(0)
    act(() => {
      root.render(<PodliteEditor value={doc} showInlineImages={true} />)
    })
    expect(node.querySelectorAll('.cm-pod-image')).toHaveLength(1)
    act(() => root.unmount())
    node.remove()
  })

  it('resolves the address against the directory it was given', async () => {
    const asked: Array<[string, string | undefined]> = []
    const node = host()
    const root = createRoot(node)
    act(() => {
      root.render(
        <PodliteEditor
          value={doc}
          showInlineImages={true}
          imageBaseDir="/docs"
          imageSrc={(src: string, baseDir?: string) => {
            asked.push([src, baseDir])
            return `${baseDir}/${src}`
          }}
        />,
      )
    })
    await act(async () => undefined)
    expect(asked).toContainEqual(['photo.png', '/docs'])
    act(() => root.unmount())
    node.remove()
  })
})
