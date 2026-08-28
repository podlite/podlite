/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { StateEffect } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
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
// the whole set again; counting those is counting the work a render caused.
const countReconfigurations = (node: HTMLElement) => {
  const view = EditorView.findFromDOM(node.querySelector('.cm-editor') as HTMLElement)
  const seat = view as unknown as { dispatch: (...specs: unknown[]) => void }
  const count = { n: 0 }
  const dispatch = seat.dispatch.bind(view)
  seat.dispatch = (...specs: unknown[]) => {
    for (const spec of specs) {
      const effects = [(spec as { effects?: unknown })?.effects].flat()
      if (effects.some(e => e instanceof StateEffect && e.is(StateEffect.reconfigure))) count.n++
    }
    return dispatch(...specs)
  }
  return count
}

describe('rendering the editor again', () => {
  it('does not reconfigure CodeMirror when the props are the same', () => {
    const node = host()
    const root = createRoot(node)
    const props = { value: '=head1 Title\n\ntext\n' }
    act(() => root.render(<PodliteEditor {...props} />))
    const seen = countReconfigurations(node)
    act(() => root.render(<PodliteEditor {...props} />))
    act(() => root.render(<PodliteEditor {...props} />))
    expect(seen.n).toBe(0)
    act(() => root.unmount())
    node.remove()
  })

  it('reconfigures when a prop the extensions read has changed', () => {
    const node = host()
    const root = createRoot(node)
    act(() => root.render(<PodliteEditor value="=head1 Title\n" showInlineImages={false} />))
    const seen = countReconfigurations(node)
    act(() => root.render(<PodliteEditor value="=head1 Title\n" showInlineImages={true} />))
    expect(seen.n).toBe(1)
    act(() => root.unmount())
    node.remove()
  })
})
