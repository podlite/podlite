/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import type { ViewUpdate } from '@uiw/react-codemirror'
import PodliteEditor from '../src/Editor'

class NoResize {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(global as any).ResizeObserver = NoResize
;(global as any).IS_REACT_ACT_ENVIRONMENT = true

const host = () => {
  const node = window.document.createElement('div')
  window.document.body.appendChild(node)
  return node
}

// A new extension list reaches CodeMirror as a reconfiguration, which resolves
// the whole set again, and a transaction says so itself.
const counter = () => {
  const seen = { n: 0 }
  const onUpdate = (update: ViewUpdate) => {
    if (update.transactions.some(tr => tr.reconfigured)) seen.n++
  }
  return { seen, onUpdate }
}

describe('rendering the editor again', () => {
  it('does not reconfigure CodeMirror when the props are the same', () => {
    const node = host()
    const root = createRoot(node)
    const { seen, onUpdate } = counter()
    const props = { value: '=head1 Title\n\ntext\n', onUpdate }
    act(() => root.render(<PodliteEditor {...props} />))
    seen.n = 0
    act(() => root.render(<PodliteEditor {...props} />))
    act(() => root.render(<PodliteEditor {...props} />))
    expect(seen.n).toBe(0)
    act(() => root.unmount())
    node.remove()
  })

  it('reconfigures when a prop the extensions read has changed', () => {
    const node = host()
    const root = createRoot(node)
    const { seen, onUpdate } = counter()
    act(() => root.render(<PodliteEditor value="=head1 Title\n" showInlineImages={false} onUpdate={onUpdate} />))
    seen.n = 0
    act(() => root.render(<PodliteEditor value="=head1 Title\n" showInlineImages={true} onUpdate={onUpdate} />))
    expect(seen.n).toBe(1)
    act(() => root.unmount())
    node.remove()
  })
})
