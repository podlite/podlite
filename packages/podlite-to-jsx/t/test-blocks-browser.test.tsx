/**
 * @jest-environment jsdom
 */
import { TestPodlite as Podlite, revealTest } from '../src/index'
import React from 'react'
import { act } from 'react-dom/test-utils'
import { renderToString } from 'react-dom/server.node'
import { hydrateRoot, Root } from 'react-dom/client'
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const test = (attrs = '') => `=begin test :id<t1> :caption('the caption')${attrs}
=begin fixture
Fixture text.
=end fixture
=for assert
para
=end test`

let container: HTMLDivElement
let root: Root | undefined
let errors: jest.SpyInstance

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  errors = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  Element.prototype.scrollIntoView = jest.fn()
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  container.remove()
  errors.mockRestore()
})

const hydrate = (source: string) => {
  const element = <Podlite>{source}</Podlite>
  container.innerHTML = renderToString(element)
  act(() => {
    root = hydrateRoot(container, element)
  })
  return element
}

const details = () => container.querySelector('details.test') as HTMLDetailsElement

describe('a test in the browser', () => {
  it('renders open with a window present, as on the server, then folds', () => {
    const element = hydrate(`=begin pod\nA rule.\n\n${test()}\n=end pod\n`)
    // React 18 does not report an attribute that differs on hydration, so the first
    // render is checked directly, here where window exists
    expect(renderToString(element)).toContain('<details class="test" id="t1" open="">')
    const mismatches = errors.mock.calls.filter(call => /did not match|hydrat/i.test(String(call[0])))
    expect(mismatches).toEqual([])
    expect(details().open).toBe(false)
  })

  it('stays open when the author says so on the test', () => {
    hydrate(`=begin pod\nA rule.\n\n${test(' :!folded')}\n=end pod\n`)
    expect(details().open).toBe(true)
  })

  it('stays open for :folded(0)', () => {
    hydrate(`=begin pod\nA rule.\n\n${test(' :folded(0)')}\n=end pod\n`)
    expect(details().open).toBe(true)
  })

  it('stays open when =config says so for every test', () => {
    hydrate(`=begin pod\n=config test :!folded\n\nA rule.\n\n${test()}\n=end pod\n`)
    expect(details().open).toBe(true)
  })

  it('opens when the address points at it, with the folded section above it', () => {
    window.history.replaceState(null, '', '/#t1')
    hydrate(`=begin pod\n=for head1 :folded\nSection\n\nA rule.\n\n${test()}\n=end pod\n`)
    expect(details().open).toBe(true)
    expect((container.querySelector('details.folded-section') as HTMLDetailsElement).open).toBe(true)
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })

  it('opens when the address changes to it', () => {
    hydrate(`=begin pod\nA rule.\n\n${test()}\n=end pod\n`)
    expect(details().open).toBe(false)
    act(() => {
      window.history.replaceState(null, '', '/#t1')
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(details().open).toBe(true)
  })

  it('opens when a site asks for it by its id, as on a click at the address already shown', () => {
    window.history.replaceState(null, '', '/#t1')
    hydrate(`=begin pod\n=for head1 :folded\nSection\n\nA rule.\n\n${test()}\n=end pod\n`)
    details().open = false
    ;(container.querySelector('details.folded-section') as HTMLDetailsElement).open = false
    expect(revealTest('t1')).toBe(true)
    expect(details().open).toBe(true)
    expect((container.querySelector('details.folded-section') as HTMLDetailsElement).open).toBe(true)
  })

  it('opens nothing for an id that is not a test', () => {
    hydrate(`=begin pod\n=for para :id<p1>\nA rule.\n\n${test()}\n=end pod\n`)
    expect(revealTest('p1')).toBe(false)
    expect(revealTest('absent')).toBe(false)
    expect(details().open).toBe(false)
  })

  it('keeps what the reader opened across a new render', () => {
    const element = hydrate(`=begin pod\nA rule.\n\n${test()}\n=end pod\n`)
    details().open = true
    act(() => root?.render(element))
    expect(details().open).toBe(true)
  })

  it('keeps the card inside the window when its line stands at the right edge', () => {
    hydrate(`=begin pod\nA rule.\n\n${test()}\n=end pod\n`)
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 1000 })
    const summary = container.querySelector('summary.test-summary') as HTMLElement
    summary.getBoundingClientRect = () => ({ left: 900, right: 1000, top: 0, bottom: 20 } as DOMRect)
    const box = jest
      .spyOn(HTMLDivElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLDivElement) {
        const left = parseFloat(this.style.left) || 0
        return { left, right: left + 400, top: 0, bottom: 100 } as DOMRect
      })
    act(() => {
      summary.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    })
    const card = document.body.querySelector('.test-card') as HTMLElement
    box.mockRestore()
    delete (document.documentElement as { clientWidth?: number }).clientWidth
    expect(parseFloat(card.style.left) + 400).toBeLessThanOrEqual(1000 - 12)
    expect(parseFloat(card.style.left)).toBeGreaterThanOrEqual(8)
  })

  it('shows a card with the test while its line is pointed at', () => {
    hydrate(`=begin pod\nA rule.\n\n${test()}\n=end pod\n`)
    act(() => {
      container.querySelector('summary.test-summary')?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    })
    expect(document.body.querySelector('.test-card')?.textContent).toContain('Fixture text.')
  })
})
