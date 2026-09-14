/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'

const received: string[] = []
// set by a test to hold the highlighter's answer back
let holdAnswers = false
jest.mock('../src/shiki', () => ({
  codeToThemedHtml: ({ code }: { code: string }) => {
    received.push(code)
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
  holdAnswers = false
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
    const render = (renderMode: string) =>
      root.render(
        <HighlightedCode node={partlyHidden} ctx={{ renderMode }} keyProp="k">
          x
        </HighlightedCode>,
      )
    await act(async () => render('draft'))
    expect(host.innerHTML).toContain('Secret')
    holdAnswers = true
    await act(async () => render('production'))
    expect(host.innerHTML).not.toContain('Secret')
    act(() => root.unmount())
    host.remove()
  })
})
