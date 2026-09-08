/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { foldedRanges } from '@codemirror/language'
import { EditorView, type ViewUpdate } from '@codemirror/view'
import PodliteEditor from '../src/Editor'
import type { EditorSessionState } from '../src/types'

class NoResize {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(global as any).ResizeObserver = NoResize
;(global as any).IS_REACT_ACT_ENVIRONMENT = true
// jsdom lays nothing out, so the preview has no scrolling of its own
;(Element.prototype as any).scrollTo = function () {}

const host = () => {
  const node = window.document.createElement('div')
  window.document.body.appendChild(node)
  return node
}

const SHORT = '=head1 A\n'
const LONG = '=head1 B\n\n' + 'a line of text\n'.repeat(12)

// Both sit past the end of SHORT, so a restore run against the wrong document
// cannot produce them by accident
const SAVED: EditorSessionState = {
  cursorOffset: 120,
  foldedRanges: [{ from: 100, to: 150 }],
}

const settle = () => new Promise(resolve => setTimeout(resolve, 300))

const foldsIn = (view: EditorView): Array<{ from: number; to: number }> => {
  const found: Array<{ from: number; to: number }> = []
  foldedRanges(view.state).between(0, view.state.doc.length, (from, to) => {
    found.push({ from, to })
  })
  return found
}

describe('switching files while the editor is being typed in', () => {
  it('restores the saved position against the document it was saved for', async () => {
    expect(LONG.length).toBeGreaterThan(SAVED.cursorOffset!)

    const node = host()
    const root = createRoot(node)

    await act(async () => {
      root.render(<PodliteEditor value={SHORT} initialEditorState={{ cursorOffset: 0 }} />)
    })

    const view = EditorView.findFromDOM(node)!
    expect(view).toBeTruthy()

    // A keystroke, not a programmatic replacement: the wrapper watches for this
    // to decide that someone is typing
    await act(async () => {
      view.dispatch({ changes: { from: view.state.doc.length, insert: 'x' } })
    })

    // The host opens another file: new text and the position saved for it arrive
    // in the same render
    await act(async () => {
      root.render(<PodliteEditor value={LONG} initialEditorState={SAVED} />)
    })

    // Before any waiting: the text and the position are in place already, because
    // the editor puts the text in before the parent restores against it
    expect(view.state.doc.toString()).toBe(LONG)
    expect(view.state.selection.main.head).toBe(SAVED.cursorOffset)

    expect(foldsIn(view)).toEqual(SAVED.foldedRanges)

    // and nothing arrives late to undo it
    await act(async () => {
      await settle()
    })
    expect(view.state.selection.main.head).toBe(SAVED.cursorOffset)

    await act(async () => root.unmount())
    node.remove()
  })

  it('restores a session whose file carries the very same text', () => {
    // Two files can hold identical text and different saved positions. Nothing
    // about the document changes, so only the session itself can be the trigger
    const node = host()
    const root = createRoot(node)

    act(() => {
      root.render(<PodliteEditor value={LONG} initialEditorState={{ cursorOffset: 5 }} />)
    })
    const view = EditorView.findFromDOM(node)!
    expect(view.state.selection.main.head).toBe(5)

    act(() => {
      root.render(<PodliteEditor value={LONG} initialEditorState={SAVED} />)
    })
    expect(view.state.doc.toString()).toBe(LONG)
    expect(view.state.selection.main.head).toBe(SAVED.cursorOffset)

    act(() => root.unmount())
    node.remove()
  })

  it('does not leave the last file folded when this one saved no folds', () => {
    const node = host()
    const root = createRoot(node)

    act(() => {
      root.render(<PodliteEditor value={LONG} initialEditorState={SAVED} />)
    })
    const view = EditorView.findFromDOM(node)!
    expect(foldsIn(view)).toEqual(SAVED.foldedRanges)

    act(() => {
      root.render(<PodliteEditor value={LONG} initialEditorState={{ cursorOffset: 3, foldedRanges: [] }} />)
    })
    expect(foldsIn(view)).toEqual([])

    act(() => root.unmount())
    node.remove()
  })

  it('makes no transaction when the value handed in is the one already there', () => {
    const node = host()
    const root = createRoot(node)
    let changes = 0
    const props = { value: LONG, onUpdate: (u: ViewUpdate) => u.docChanged && changes++ }

    act(() => {
      root.render(<PodliteEditor {...props} />)
    })
    changes = 0
    act(() => {
      root.render(<PodliteEditor {...props} />)
    })
    expect(changes).toBe(0)

    act(() => root.unmount())
    node.remove()
  })

  it('survives the double pass React makes in strict mode', () => {
    const node = host()
    const root = createRoot(node)

    act(() => {
      root.render(
        <React.StrictMode>
          <PodliteEditor value={LONG} initialEditorState={SAVED} />
        </React.StrictMode>,
      )
    })
    const view = EditorView.findFromDOM(node)!
    expect(view.state.doc.toString()).toBe(LONG)
    expect(view.state.selection.main.head).toBe(SAVED.cursorOffset)

    act(() => root.unmount())
    node.remove()
  })
})
