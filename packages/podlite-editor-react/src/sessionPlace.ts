import { EditorView } from '@codemirror/view'
import type { EditorSessionState } from './types'

/*
The place of a note — its scroll and the line of its cursor — is restored as an
intention of one opening: it is applied when the editor is measured, read back,
and applied again on every change of the layout until it is reached, the person
acts, or another note is opened. Frames are not counted and nothing is polled.
*/

export type PlaceOutcome = 'reached' | 'cancelled' | 'replaced'

// The margin marks the scroll target the restore sends: a target sent by typing
// or by the default of CodeMirror is 'nearest' with a margin of its own. Our hook
// moves the view itself for this target, so the value is never used as a margin.
export const RESTORE_MARGIN = 7.5

// What CodeMirror 6.43 and the extensions of this editor listen to on the content,
// in two columns. Taking the input of a person ends the restore; the other events
// come from the program, or do not move the place, or follow an event of the first
// column. A new listener after an update of CodeMirror or of an extension is sorted
// here by hand; a test compares the list with what the editor listens to.
export const CANCEL_EVENTS = [
  'keydown',
  'beforeinput',
  'compositionstart',
  'paste',
  'drop',
  'cut',
  'mousedown',
  'touchstart',
] as const
export const KEEP_EVENTS = [
  'focus',
  'blur',
  'scroll',
  'copy',
  'contextmenu',
  'dragstart',
  'dragend',
  'compositionupdate',
  'compositionend',
  'input',
  'wheel',
  'mousewheel',
  'touchmove',
  'touchend',
  'keyup',
  'mouseleave',
  'click',
  'dragover',
  'dragleave',
] as const
// a person scrolls with the wheel, a finger or the scroll bar, with or without focus
export const SCROLLER_CANCEL_EVENTS = ['wheel', 'touchstart', 'pointerdown'] as const

const scrolls = (el: HTMLElement | null | undefined): el is HTMLElement =>
  Boolean(el) &&
  el!.scrollHeight > el!.clientHeight &&
  /^(auto|scroll)$/.test(el!.ownerDocument.defaultView?.getComputedStyle(el!).overflowY || '')

// The element that scrolls in the layout of the editor now: CodeMirror's own when
// it is given a height, the wrapper when CodeMirror grows with its content. Asked
// at every read and write, since the full screen mode changes the answer.
export const scrollerOf = (view: EditorView, wrapper: HTMLElement | null | undefined): HTMLElement =>
  [view.scrollDOM, wrapper].find(scrolls) || view.scrollDOM

type Intention = { kind: 'scroll'; top: number } | { kind: 'cursor' }

export type PlaceHooks = {
  // the place as it is now, sent when a restore gives up its intention
  report: () => void
  restored: (outcome: PlaceOutcome) => void
}

export class PlaceRestore {
  private intention: Intention | null = null
  private targetSent = false
  private removers: Array<() => void> = []

  constructor(
    private readonly view: EditorView,
    private readonly wrapper: () => HTMLElement | null | undefined,
    private readonly hooks: PlaceHooks,
  ) {
    const cancel = () => this.cancel()
    const listen = (target: EventTarget, type: string) => {
      // only watching: the event still reaches CodeMirror and the default action
      target.addEventListener(type, cancel, { capture: true, passive: true })
      this.removers.push(() => target.removeEventListener(type, cancel, { capture: true }))
    }
    CANCEL_EVENTS.forEach(type => listen(view.contentDOM, type))
    const scrollers = [view.scrollDOM, wrapper()].filter(Boolean) as HTMLElement[]
    scrollers.forEach(el => SCROLLER_CANCEL_EVENTS.forEach(type => listen(el, type)))
    const doc = view.dom.ownerDocument
    const visible = () => this.retry()
    doc.addEventListener('visibilitychange', visible)
    this.removers.push(() => doc.removeEventListener('visibilitychange', visible))
    const Observer = doc.defaultView?.ResizeObserver
    const box = wrapper()
    if (Observer && box) {
      const observer = new Observer(() => this.retry())
      observer.observe(box)
      this.removers.push(() => observer.disconnect())
    }
  }

  // A new opening: what was pending for the last one is replaced. Called before
  // the cursor and the folds are put back, so their messages carry the intention.
  begin(place: EditorSessionState): void {
    if (this.intention) this.finish('replaced')
    this.targetSent = false
    this.intention =
      place.scrollTop != null
        ? { kind: 'scroll', top: place.scrollTop }
        : place.cursorOffset != null
        ? { kind: 'cursor' }
        : null
  }

  // After the cursor and the folds: an opening with nothing to scroll to is done.
  apply(): void {
    if (!this.intention) return this.hooks.restored('reached')
    this.retry()
  }

  // The scroll a message carries: the intended one while it is pending, none while
  // the cursor line is pending (a saved 0 would win over the cursor next time).
  scrollTopToReport(): number | undefined {
    if (this.intention?.kind === 'scroll') return this.intention.top
    if (this.intention?.kind === 'cursor') return undefined
    return scrollerOf(this.view, this.wrapper()).scrollTop
  }

  isOwnTarget(options: { y?: string; yMargin?: number }): boolean {
    return options.y === 'center' && options.yMargin === RESTORE_MARGIN
  }

  // The scroll hook for our own target: the line of the cursor goes to the middle
  // of the element that scrolls, and nothing above the editor moves.
  scrollOwnTarget(pos: number): true {
    if (!this.targetSent || this.intention?.kind !== 'cursor') return true
    this.targetSent = false
    const el = scrollerOf(this.view, this.wrapper())
    const line = this.view.lineBlockAt(pos)
    const top = this.lineTop(el, line.top)
    el.scrollTop = Math.max(0, top - (el.clientHeight - line.height) / 2)
    const at = this.lineTop(el, line.top)
    if (at >= el.scrollTop - 1 && at + line.height <= el.scrollTop + el.clientHeight + 1) this.finish('reached')
    return true
  }

  // From inside an update of the view, where a new transaction is not allowed.
  retryLater(): void {
    if (!this.intention) return
    queueMicrotask(() => {
      if (this.removers.length) this.retry()
    })
  }

  // Apply the intention again: on a change of the layout, a picture that came, the
  // window shown again.
  retry(): void {
    const intention = this.intention
    if (!intention) return
    if (intention.kind === 'cursor') {
      this.targetSent = true
      const head = this.view.state.selection.main.head
      this.view.dispatch({ effects: EditorView.scrollIntoView(head, { y: 'center', yMargin: RESTORE_MARGIN }) })
      return
    }
    this.view.requestMeasure({
      key: this,
      read: () => null,
      write: () => {
        if (this.intention !== intention) return
        const el = scrollerOf(this.view, this.wrapper())
        el.scrollTop = intention.top
        const reachable = el.scrollHeight - el.clientHeight
        // a document shorter than the place keeps the intention until it grows
        if (Math.abs(el.scrollTop - intention.top) <= 1 && intention.top <= reachable + 1) this.finish('reached')
      },
    })
  }

  // The person acted before the place was reached: their place stays, and the host
  // hears where the editor is now.
  cancel(): void {
    if (!this.intention) return
    this.finish('cancelled')
    this.hooks.report()
  }

  dispose(): void {
    this.intention = null
    this.targetSent = false
    this.removers.forEach(remove => remove())
    this.removers = []
  }

  private finish(outcome: PlaceOutcome): void {
    this.intention = null
    this.targetSent = false
    this.hooks.restored(outcome)
  }

  private lineTop(el: HTMLElement, lineTop: number): number {
    const box = el.getBoundingClientRect()
    return el.scrollTop + this.view.documentTop - box.top - el.clientTop + lineTop
  }
}
