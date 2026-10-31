/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { EditorView } from '@codemirror/view'
import PodliteEditor from '../src/Editor'
import type { EditorSessionState } from '../src/types'
import { CANCEL_EVENTS, KEEP_EVENTS, RESTORE_MARGIN, type PlaceOutcome } from '../src/sessionPlace'

// A resize observer the test calls by hand: jsdom lays nothing out
const observers: Array<() => void> = []
class ManualResize {
  private readonly targets: Element[] = []
  private readonly call = () =>
    this.callback(
      this.targets.map(target => ({ target } as ResizeObserverEntry)),
      this as never,
    )
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(target: Element) {
    this.targets.push(target)
    if (!observers.includes(this.call)) observers.push(this.call)
  }
  unobserve() {}
  disconnect() {
    const at = observers.indexOf(this.call)
    if (at >= 0) observers.splice(at, 1)
  }
}
;(global as any).ResizeObserver = ManualResize
;(window as any).ResizeObserver = ManualResize
;(global as any).IS_REACT_ACT_ENVIRONMENT = true
;(Element.prototype as any).scrollTo = function () {}
;(Range.prototype as any).getClientRects = () => []
;(Range.prototype as any).getBoundingClientRect = () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 })

// an event as the browser would send it: a touch carries where it is
const event = (type: string) => {
  const touch = [{ clientX: 0, clientY: 0 }]
  return Object.assign(new Event(type, { bubbles: true }), {
    touches: touch,
    targetTouches: touch,
    changedTouches: touch,
  })
}

const resized = () => observers.slice().forEach(callback => callback())

type Box = { scrollHeight: number; clientHeight: number; overflowY?: string }
// Gives an element the sizes a browser would and a scrollTop it keeps in range;
// writes are recorded
const layout = (el: HTMLElement, box: Box) => {
  const state = { ...box, top: 0, writes: [] as number[] }
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => state.scrollHeight })
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => state.clientHeight })
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => state.top,
    set: (value: number) => {
      state.top = Math.max(0, Math.min(value, Math.max(0, state.scrollHeight - state.clientHeight)))
      state.writes.push(state.top)
    },
  })
  el.style.overflowY = box.overflowY ?? 'auto'
  return state
}

const LONG = '=begin pod\n\n' + Array.from({ length: 100 }, (_, i) => `Paragraph ${i}.\n\n`).join('') + '=end pod\n'
const FAR = LONG.indexOf('Paragraph 80.')

type Mounted = {
  root: Root
  node: HTMLElement
  view: EditorView
  wrapper: HTMLElement
  messages: EditorSessionState[]
  outcomes: PlaceOutcome[]
  open: (place: EditorSessionState | undefined, props?: object) => Promise<void>
  done: () => Promise<void>
}

// The editor first without a place, so the test can lay it out; then the host opens
// a note with its place, as Axona and Desktop do
const mount = async (props: object = {}): Promise<Mounted> => {
  const node = window.document.createElement('div')
  window.document.body.appendChild(node)
  const root = createRoot(node)
  const messages: EditorSessionState[] = []
  const outcomes: PlaceOutcome[] = []
  const render = (place: EditorSessionState | undefined, extra: object = {}) =>
    root.render(
      <PodliteEditor
        value={LONG}
        initialEditorState={place}
        onEditorStateChange={state => messages.push(state)}
        onPlaceRestored={outcome => outcomes.push(outcome)}
        {...props}
        {...extra}
      />,
    )
  await act(async () => render(undefined))
  const view = EditorView.findFromDOM(node)!
  const wrapper = node.querySelector('.podlite-editor-content') as HTMLElement
  return {
    root,
    node,
    view,
    wrapper,
    messages,
    outcomes,
    open: async (place, extra) => act(async () => render(place, extra)),
    done: async () => {
      await act(async () => root.unmount())
      node.remove()
    },
  }
}

const measure = async (view: EditorView) =>
  act(async () => {
    ;(view as any).measure()
    await Promise.resolve()
    ;(view as any).measure()
  })

// the editor grows with its content and the wrapper scrolls, as in Axona
const wrapperScrolls = (m: Mounted, wrapperBox: Partial<Box> = {}) => {
  const outer = layout(m.wrapper, { scrollHeight: 2000, clientHeight: 300, ...wrapperBox })
  const inner = layout(m.view.scrollDOM, { scrollHeight: 2000, clientHeight: 2000 })
  // the document moves up as the wrapper scrolls
  m.view.contentDOM.getBoundingClientRect = () =>
    ({ top: -outer.top, bottom: 0, left: 0, right: 0, width: 0, height: 0 } as DOMRect)
  return { outer, inner }
}

describe('the place of a note restored on the element that scrolls', () => {
  it('scrolls the wrapper when the wrapper scrolls', async () => {
    const m = await mount()
    const { outer } = wrapperScrolls(m)
    await m.open({ scrollTop: 500 })
    await measure(m.view)
    expect(outer.top).toBe(500)
    expect(m.outcomes).toEqual(['reached'])
    await m.done()
  })

  it('reports the scroll of the wrapper', async () => {
    const m = await mount()
    const { outer } = wrapperScrolls(m)
    await m.open({ scrollTop: 0 })
    await measure(m.view)
    outer.top = 400
    await act(async () => {
      m.wrapper.dispatchEvent(new Event('scroll'))
      await new Promise(resolve => setTimeout(resolve, 250))
    })
    expect(m.messages[m.messages.length - 1].scrollTop).toBe(400)
    await m.done()
  })

  it('reports the scroll of the wrapper when the cursor and the folds change after the restore', async () => {
    const m = await mount()
    const { outer } = wrapperScrolls(m)
    await m.open({ scrollTop: 0 })
    await measure(m.view)
    outer.top = 400
    await act(async () => {
      m.view.dispatch({ selection: { anchor: 10 } })
    })
    expect(m.messages[m.messages.length - 1].scrollTop).toBe(400)
    await m.done()
  })

  it('reaches a place the layout makes room for later', async () => {
    const m = await mount()
    const { outer } = wrapperScrolls(m, { scrollHeight: 600, clientHeight: 200 })
    await m.open({ scrollTop: 500 })
    await measure(m.view)
    expect(outer.top).toBe(400)
    expect(m.outcomes).toEqual([])
    // only the wrapper grows: CodeMirror watches its own element, not this one
    outer.scrollHeight = 1000
    await act(async () => resized())
    await measure(m.view)
    expect(outer.top).toBe(500)
    expect(m.outcomes).toEqual(['reached'])
    await m.done()
  })

  it('tries again when only the window is shown again', async () => {
    const m = await mount()
    const { outer } = wrapperScrolls(m, { scrollHeight: 600, clientHeight: 200 })
    await m.open({ scrollTop: 500 })
    await measure(m.view)
    outer.scrollHeight = 1000
    await act(async () => {
      window.document.dispatchEvent(new Event('visibilitychange'))
    })
    await measure(m.view)
    expect(outer.top).toBe(500)
    await m.done()
  })

  it('keeps a place a short document cannot reach, without trying again by itself', async () => {
    const m = await mount()
    const { outer } = wrapperScrolls(m, { scrollHeight: 300, clientHeight: 200 })
    await m.open({ scrollTop: 500 })
    for (let i = 0; i < 5; i++) await measure(m.view)
    expect(outer.writes).toEqual([100])
    expect(m.outcomes).toEqual([])
    await m.done()
  })

  it('carries the intended scroll in the messages of the cursor and the folds while it is pending', async () => {
    const m = await mount()
    wrapperScrolls(m)
    await m.open({ cursorOffset: 100, scrollTop: 500, foldedRanges: [] })
    expect(m.messages.length).toBeGreaterThan(0)
    expect(m.messages.every(message => message.scrollTop === 500)).toBe(true)
    await m.done()
  })

  it('leaves the scroll out of a message while the line of the cursor is pending', async () => {
    const m = await mount()
    await m.open({ cursorOffset: FAR })
    expect(m.messages[0]).not.toHaveProperty('scrollTop')
    await m.done()
  })

  it('brings the line of the cursor into view without the focus', async () => {
    const m = await mount({ autoFocus: false, focusOnRestore: false })
    const { outer } = wrapperScrolls(m)
    await m.open({ cursorOffset: FAR })
    await measure(m.view)
    const line = m.view.lineBlockAt(FAR)
    expect(m.view.hasFocus).toBe(false)
    expect(line.top).toBeGreaterThan(300)
    expect(outer.top).toBeLessThanOrEqual(line.top)
    expect(outer.top + 300).toBeGreaterThanOrEqual(line.top + line.height)
    expect(m.outcomes).toEqual(['reached'])
    await m.done()
  })

  it('follows the cursor when text comes in before it before the measure', async () => {
    const m = await mount({ autoFocus: false, focusOnRestore: false })
    const { outer, inner } = wrapperScrolls(m, { scrollHeight: 8000 })
    // the layout is not ready yet: CodeMirror holds the target until it has a height
    inner.clientHeight = 0
    inner.scrollHeight = 0
    const seen: Array<{ top: number; height: number }> = []
    const lineBlockAt = m.view.lineBlockAt.bind(m.view)
    m.view.lineBlockAt = (pos: number) => {
      const block = lineBlockAt(pos)
      if (pos === FAR + 180) seen.push({ top: block.top, height: block.height })
      return block
    }
    await m.open({ cursorOffset: FAR })
    await act(async () => {
      m.view.dispatch({ changes: { from: 0, insert: 'x\n\n'.repeat(60) } })
    })
    inner.clientHeight = 8000
    inner.scrollHeight = 8000
    await measure(m.view)
    expect(m.view.state.selection.main.head).toBe(FAR + 180)
    expect(m.outcomes).toEqual(['reached'])
    // the line as the hook saw it when it wrote; the hook counts the padding above
    // the document too, a few pixels
    const centred = seen.map(line => Math.max(0, line.top - (300 - line.height) / 2))
    expect(outer.writes.some(write => centred.some(at => Math.abs(write - at) <= 8))).toBe(true)
    await m.done()
  })

  it('ignores a target of its own left from a note opened before', async () => {
    const m = await mount({ autoFocus: false, focusOnRestore: false })
    const { outer, inner } = wrapperScrolls(m)
    // the layout is not ready yet
    inner.clientHeight = 0
    inner.scrollHeight = 0
    await m.open({ cursorOffset: FAR })
    // the next note comes before the first was measured
    await m.open({ scrollTop: 200 })
    inner.clientHeight = 2000
    inner.scrollHeight = 2000
    await act(async () => resized())
    await measure(m.view)
    expect(outer.writes[outer.writes.length - 1]).toBe(200)
    expect(m.outcomes).toEqual(['replaced', 'reached'])
    await m.done()
  })
})

describe('the person acts before the place is reached', () => {
  const pending = async () => {
    const m = await mount()
    const parts = wrapperScrolls(m, { scrollHeight: 300, clientHeight: 200 })
    await m.open({ scrollTop: 500 })
    await measure(m.view)
    return { m, ...parts }
  }

  it.each(CANCEL_EVENTS)('gives the place up on %s', async type => {
    const { m } = await pending()
    await act(async () => {
      m.view.contentDOM.dispatchEvent(event(type))
    })
    expect(m.outcomes).toEqual(['cancelled'])
    await m.done()
  })

  // the wheel and a touch on the content reach the element that scrolls, which takes them as a person scrolling
  it.each(KEEP_EVENTS.filter(type => type !== 'focus' && type !== 'wheel'))('keeps the place on %s', async type => {
    const { m } = await pending()
    await act(async () => {
      m.view.contentDOM.dispatchEvent(event(type))
    })
    expect(m.outcomes).toEqual([])
    await m.done()
  })

  it('keeps the place when the editor takes the focus itself or the text is changed from outside', async () => {
    const { m } = await pending()
    await act(async () => m.view.focus())
    const paragraph = m.view.contentDOM.querySelector('.cm-line') as HTMLElement
    await act(async () => {
      paragraph.appendChild(window.document.createTextNode(' Extra.'))
      ;(m.view as any).observer.flush()
    })
    expect(m.outcomes).toEqual([])
    await m.done()
  })

  it('gives the place up on the wheel and reports where the editor is', async () => {
    const { m, outer } = await pending()
    await act(async () => {
      m.wrapper.dispatchEvent(new Event('wheel'))
    })
    expect(m.outcomes).toEqual(['cancelled'])
    expect(m.messages[m.messages.length - 1].scrollTop).toBe(outer.top)
    expect(outer.top).toBe(100)
    await m.done()
  })

  it('gives the place up on a paste and lets the paste in', async () => {
    const { m } = await pending()
    const head = m.view.state.selection.main.head
    const paste = new Event('paste', { bubbles: true, cancelable: true }) as any
    paste.clipboardData = { getData: (type: string) => (type === 'text/plain' ? 'Pasted' : ''), types: ['text/plain'] }
    await act(async () => {
      m.view.contentDOM.dispatchEvent(paste)
    })
    expect(m.outcomes).toEqual(['cancelled'])
    expect(m.view.state.doc.toString().slice(head, head + 6)).toBe('Pasted')
    expect(m.view.state.selection.main.head).toBe(head + 6)
    await m.done()
  })

  it('sorts every listener CodeMirror and the editor put on the content', async () => {
    const added: Array<[EventTarget, string]> = []
    const add = EventTarget.prototype.addEventListener
    EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, ...rest: any[]) {
      added.push([this, type])
      return (add as any).call(this, type, ...rest)
    }
    const m = await mount()
    EventTarget.prototype.addEventListener = add
    const types = new Set(added.filter(([target]) => target === m.view.contentDOM).map(([, type]) => type))
    const sorted = new Set<string>([...CANCEL_EVENTS, ...KEEP_EVENTS])
    expect([...types].filter(type => !sorted.has(type))).toEqual([])
    expect([...types].sort()).toMatchSnapshot()
    await m.done()
  })
})

describe('the focus and the signal of the restore', () => {
  it('focuses once after the restore by default, also for an empty place', async () => {
    const m = await mount({ autoFocus: false })
    await m.open({})
    expect(m.view.hasFocus).toBe(true)
    expect(m.outcomes).toEqual(['reached'])
    await m.done()
  })

  it('leaves the focus where it is when the host asks so', async () => {
    const m = await mount({ autoFocus: false, focusOnRestore: false })
    await m.open({ scrollTop: 0 })
    expect(m.view.hasFocus).toBe(false)
    await m.done()
  })

  it('does not take the focus back on a later try', async () => {
    const m = await mount({ autoFocus: false })
    wrapperScrolls(m, { scrollHeight: 300, clientHeight: 200 })
    await m.open({ scrollTop: 500 })
    const button = window.document.createElement('button')
    window.document.body.appendChild(button)
    button.focus()
    expect(window.document.activeElement).toBe(button)
    await act(async () => resized())
    await measure(m.view)
    expect(window.document.activeElement).toBe(button)
    button.remove()
    await m.done()
  })

  it('does nothing without a place and nothing after the editor is gone', async () => {
    const m = await mount()
    expect(m.outcomes).toEqual([])
    wrapperScrolls(m, { scrollHeight: 300, clientHeight: 200 })
    await m.open({ scrollTop: 500 })
    await m.done()
    window.document.dispatchEvent(new Event('visibilitychange'))
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(m.outcomes).toEqual([])
  })
})

describe('choosing the element that scrolls', () => {
  it('takes CodeMirror when it scrolls and the wrapper when CodeMirror shows its overflow', async () => {
    const m = await mount()
    const inner = layout(m.view.scrollDOM, { scrollHeight: 2000, clientHeight: 300 })
    const outer = layout(m.wrapper, { scrollHeight: 2000, clientHeight: 300 })
    await m.open({ scrollTop: 500 })
    await measure(m.view)
    expect(inner.top).toBe(500)
    expect(outer.top).toBe(0)
    m.view.scrollDOM.style.overflowY = 'visible'
    await m.open({ scrollTop: 300 })
    await measure(m.view)
    expect(outer.top).toBe(300)
    await m.done()
  })
})

describe('the page around the editor stays where it is', () => {
  const scrolled = (m: Mounted) => {
    const calls: unknown[] = []
    ;(window as any).scrollBy = (...args: unknown[]) => calls.push(args)
    ;(m.view as any).docView.coordsAt = () => ({ top: 5000, bottom: 5020, left: 0, right: 10 })
    layout(m.view.scrollDOM, { scrollHeight: 300, clientHeight: 300 })
    return calls
  }
  const errors = jest.spyOn(console, 'error')

  it('keeps a change the editor did not make from scrolling the page while unfocused', async () => {
    const m = await mount({ autoFocus: false, focusOnRestore: false })
    const calls = scrolled(m)
    errors.mockClear()
    await act(async () => {
      m.view.dispatch({ effects: EditorView.scrollIntoView(FAR) })
    })
    await measure(m.view)
    expect(calls).toEqual([])
    expect(errors).not.toHaveBeenCalled()
    await m.done()
  })

  it('lets the page scroll for the caret of a focused editor, which shows the check can see it', async () => {
    const m = await mount({ autoFocus: false, focusOnRestore: false })
    const calls = scrolled(m)
    await act(async () => m.view.focus())
    await act(async () => {
      m.view.dispatch({ effects: EditorView.scrollIntoView(FAR) })
    })
    await measure(m.view)
    expect(calls.length).toBeGreaterThan(0)
    await m.done()
  })

  it('never lets its own target reach the page', async () => {
    const m = await mount({ autoFocus: false, focusOnRestore: false })
    const calls = scrolled(m)
    errors.mockClear()
    await m.open({ cursorOffset: FAR })
    await measure(m.view)
    await act(async () =>
      m.view.dispatch({ effects: EditorView.scrollIntoView(FAR, { y: 'center', yMargin: RESTORE_MARGIN }) }),
    )
    await measure(m.view)
    expect(calls).toEqual([])
    expect(errors).not.toHaveBeenCalled()
    await m.done()
  })
})

describe('a picture that comes later', () => {
  it('asks the editor to measure when the picture has loaded', async () => {
    const m = await mount({ value: '=Image photo.png\n\nAfter\n', showInlineImages: true })
    const img = m.node.querySelector('.cm-pod-image img') as HTMLImageElement
    expect(img).toBeTruthy()
    const asked = jest.spyOn(m.view, 'requestMeasure')
    await act(async () => {
      img.dispatchEvent(new Event('load'))
    })
    expect(asked).toHaveBeenCalled()
    asked.mockRestore()
    await m.done()
  })
})
