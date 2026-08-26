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
;(global as any).ResizeObserver = NoResize
;(global as any).IS_REACT_ACT_ENVIRONMENT = true

// No language is declared, so the highlighter never starts and the caption is
// the only thing under test
const doc = ['=begin pod', '', '=begin code :caption<Example>', 'const x = 42', '=end code', '', '=end pod', ''].join(
  '\n',
)

describe('a code block with a caption in the preview', () => {
  it('keeps its caption while highlighting is on', () => {
    const host = window.document.createElement('div')
    window.document.body.appendChild(host)
    const root = createRoot(host)
    act(() => {
      root.render(<PodliteEditor value={doc} enableHighlighting={true} />)
    })
    // the source text is on screen too, so the rendered element is what counts
    const caption = host.querySelector('.code-block .caption')
    expect(caption?.textContent).toBe('Example')
    act(() => root.unmount())
    host.remove()
  })
})
