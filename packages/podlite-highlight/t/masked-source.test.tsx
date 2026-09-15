/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'

const received: string[] = []
const themes: string[] = []
// set by a test to hold the highlighter's answer back
let holdAnswers = false
jest.mock('../src/shiki', () => ({
  codeToThemedHtml: ({ code, theme }: { code: string; theme: string }) => {
    received.push(code)
    themes.push(theme)
    return holdAnswers ? new Promise(() => undefined) : Promise.resolve(`<pre class="shiki"><code>${code}</code></pre>`)
  },
}))

import { isCovered } from '@podlite/schema'
import HighlightedCode, { extractPlainAndDecorations } from '../src/HighlightedCode'
;(global as any).IS_REACT_ACT_ENVIRONMENT = true

// code whose middle word is hidden with G<>
const partlyHidden = {
  type: 'block',
  name: 'code',
  config: [{ name: 'lang', value: 'javascript' }],
  content: [
    { type: 'verbatim', value: 'const word = "' },
    { type: 'fcode', name: 'G', guarded: true, content: [{ type: 'text', value: 'Secret', guarded: true }] },
    { type: 'verbatim', value: '"' },
  ],
}

const mount = async (ctx: { renderMode?: string }): Promise<HTMLElement> => {
  const host = window.document.createElement('div')
  window.document.body.appendChild(host)
  const root = createRoot(host)
  await act(async () => {
    root.render(
      <HighlightedCode node={partlyHidden} ctx={ctx} keyProp="k">
        x
      </HighlightedCode>,
    )
  })
  const dom = host.cloneNode(true) as HTMLElement
  act(() => root.unmount())
  host.remove()
  return dom
}

beforeEach(() => {
  received.length = 0
  themes.length = 0
  holdAnswers = false
  window.document.body.className = ''
})

describe('hidden text in highlighted code', () => {
  it('reaches the highlighter masked, keeping its length', () => {
    const { plain } = extractPlainAndDecorations(partlyHidden.content, node =>
      isCovered(node, { renderMode: 'production' }),
    )
    expect(plain).toBe('const word = "██████"')
  })

  it('stays hidden on the page once the highlighter has answered', async () => {
    const dom = await mount({ renderMode: 'production' })
    expect(received).toEqual(['const word = "██████"'])
    expect(dom.innerHTML).not.toContain('Secret')
  })

  it('is shown in draft', async () => {
    const dom = await mount({ renderMode: 'draft' })
    expect(received).toEqual(['const word = "Secret"'])
    expect(dom.innerHTML).toContain('Secret')
  })

  it('does not keep the draft highlight on the page after switching to production', async () => {
    const host = window.document.createElement('div')
    window.document.body.appendChild(host)
    const root = createRoot(host)
    // what the page holds once it is laid out, before any effect of this render runs
    const laidOut: string[] = []
    const Probe = ({ renderMode }: { renderMode: string }) => {
      React.useLayoutEffect(() => {
        laidOut.push(host.innerHTML)
      })
      return (
        <HighlightedCode node={partlyHidden} ctx={{ renderMode }} keyProp="k">
          x
        </HighlightedCode>
      )
    }
    const render = (renderMode: string) => root.render(<Probe renderMode={renderMode} />)
    await act(async () => render('draft'))
    expect(host.innerHTML).toContain('Secret')
    holdAnswers = true
    laidOut.length = 0
    await act(async () => render('production'))
    expect(laidOut[0]).not.toContain('Secret')
    expect(host.innerHTML).not.toContain('Secret')
    act(() => root.unmount())
    host.remove()
  })

  it('keeps the highlight when the same text is drawn again', async () => {
    const host = window.document.createElement('div')
    window.document.body.appendChild(host)
    const root = createRoot(host)
    const render = () =>
      root.render(
        <HighlightedCode node={{ ...partlyHidden, content: [...partlyHidden.content] }} ctx={{}} keyProp="k">
          x
        </HighlightedCode>,
      )
    await act(async () => render())
    expect(host.innerHTML).toContain('class="shiki"')
    holdAnswers = true
    await act(async () => render())
    expect(host.innerHTML).toContain('class="shiki"')
    expect(received).toHaveLength(1)
    act(() => root.unmount())
    host.remove()
  })

  it('highlights again when the page changes its theme', async () => {
    const host = window.document.createElement('div')
    window.document.body.appendChild(host)
    const root = createRoot(host)
    const render = () =>
      root.render(
        <HighlightedCode node={partlyHidden} ctx={{}} keyProp="k">
          x
        </HighlightedCode>,
      )
    await act(async () => render())
    window.document.body.className = 'dark'
    await act(async () => render())
    expect(themes).toEqual(['light', 'dark'])
    act(() => root.unmount())
    host.remove()
  })

  it('does not show an answer made for the theme the page has left', async () => {
    const host = window.document.createElement('div')
    window.document.body.appendChild(host)
    const root = createRoot(host)
    const render = () =>
      root.render(
        <HighlightedCode node={partlyHidden} ctx={{}} keyProp="k">
          x
        </HighlightedCode>,
      )
    holdAnswers = true
    await act(async () => render())
    window.document.body.className = 'dark'
    await act(async () => render())
    expect(themes).toEqual(['light', 'dark'])
    expect(host.innerHTML).not.toContain('class="shiki"')
    act(() => root.unmount())
    host.remove()
  })
})
