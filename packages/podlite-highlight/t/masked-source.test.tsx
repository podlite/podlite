/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'

const received: string[] = []
jest.mock('../src/shiki', () => ({
  codeToThemedHtml: async ({ code }: { code: string }) => {
    received.push(code)
    return `<pre class="shiki"><code>${code}</code></pre>`
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
})
