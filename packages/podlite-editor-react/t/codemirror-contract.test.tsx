/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { EditorView } from '@codemirror/view'
import { EditorState, StateEffect } from '@codemirror/state'
import PodliteEditor from '../src/Editor'

class NoResize {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(global as any).ResizeObserver = NoResize
;(global as any).IS_REACT_ACT_ENVIRONMENT = true
;(Element.prototype as any).scrollTo = function () {}

const host = () => {
  const node = window.document.createElement('div')
  window.document.body.appendChild(node)
  return node
}

// What the package this replaced accepted, and what callers may still be passing
describe('the props the old layer took', () => {
  it('takes a theme named as a string without throwing', () => {
    const node = host()
    const root = createRoot(node)
    // 'dark' used to select a theme. It selects none now, but a caller passing it
    // must not bring the editor down: an unknown value in an extension set throws
    expect(() =>
      act(() => {
        root.render(<PodliteEditor value="text" theme="dark" />)
      }),
    ).not.toThrow()
    expect(EditorView.findFromDOM(node)).toBeTruthy()
    act(() => root.unmount())
    node.remove()
  })

  it('says out loud that an inert prop does nothing', () => {
    const node = host()
    const root = createRoot(node)
    const said: string[] = []
    const warn = console.warn
    console.warn = (...args: unknown[]) => said.push(String(args[0]))
    act(() => {
      root.render(<PodliteEditor value="text" onStatistics={() => undefined} />)
    })
    console.warn = warn
    expect(said.some(line => line.includes('onStatistics'))).toBe(true)
    act(() => root.unmount())
    node.remove()
  })

  it('keeps the ones it no longer implements out of the markup', () => {
    const node = host()
    const root = createRoot(node)
    act(() => {
      root.render(<PodliteEditor value="text" placeholder="ghost" minHeight="10px" maxWidth="20px" />)
    })
    const editor = node.querySelector('.cm-theme')!
    for (const name of ['placeholder', 'minheight', 'maxwidth']) {
      expect(editor.hasAttribute(name)).toBe(false)
    }
    act(() => root.unmount())
    node.remove()
  })

  it('still hands the view to a caller that asked for it', () => {
    const node = host()
    const root = createRoot(node)
    let seen: EditorView | undefined
    act(() => {
      root.render(<PodliteEditor value="text" onCreateEditor={view => (seen = view)} />)
    })
    expect(seen).toBeTruthy()
    expect(seen).toBe(EditorView.findFromDOM(node))
    act(() => root.unmount())
    node.remove()
  })

  it('passes ordinary element attributes on, as it always did', () => {
    const node = host()
    const root = createRoot(node)
    act(() => {
      root.render(<PodliteEditor value="text" id="mine" data-role="editor" />)
    })
    const editor = node.querySelector('#mine')!
    expect(editor).toBeTruthy()
    expect(editor.getAttribute('data-role')).toBe('editor')
    act(() => root.unmount())
    node.remove()
  })

  it('keeps what a caller added from onCreateEditor', () => {
    // The editor is built with its extension set already; reconfiguring it the
    // moment it appears would silently drop anything installed in the callback
    const node = host()
    const root = createRoot(node)
    act(() => {
      root.render(
        <PodliteEditor
          value="text"
          onCreateEditor={view =>
            view.dispatch({ effects: StateEffect.appendConfig.of(EditorState.readOnly.of(true)) })
          }
        />,
      )
    })
    expect(EditorView.findFromDOM(node)!.state.readOnly).toBe(true)
    act(() => root.unmount())
    node.remove()
  })

  it('applies a prop the create callback itself changed', () => {
    // The constructor was handed the old set; if the effect mistakes the new one
    // for what is already installed, the change never reaches the editor
    const node = host()
    const root = createRoot(node)

    const Host = () => {
      const [readOnly, setReadOnly] = React.useState(false)
      return <PodliteEditor value="text" readOnly={readOnly} onCreateEditor={() => setReadOnly(true)} />
    }

    act(() => {
      root.render(<Host />)
    })
    expect(EditorView.findFromDOM(node)!.state.readOnly).toBe(true)
    act(() => root.unmount())
    node.remove()
  })
})
