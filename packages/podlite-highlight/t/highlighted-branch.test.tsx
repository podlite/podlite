/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'

const themed = jest.fn(async () => '<pre class="shiki"><code>const x = 42</code></pre>')
jest.mock('../src/shiki', () => ({ codeToThemedHtml: () => themed() }))

import HighlightedCode from '../src/HighlightedCode'
;(global as any).IS_REACT_ACT_ENVIRONMENT = true

const codeNode = (config: Array<{ name: string; value: string }>) => ({
  type: 'block',
  name: 'code',
  content: [{ type: 'verbatim', value: 'const x = 42' }],
  config,
})

const mount = async (element: React.ReactElement): Promise<HTMLElement> => {
  const host = window.document.createElement('div')
  window.document.body.appendChild(host)
  const root = createRoot(host)
  await act(async () => {
    root.render(element)
  })
  const dom = host.cloneNode(true) as HTMLElement
  act(() => root.unmount())
  host.remove()
  return dom
}

beforeEach(() => themed.mockClear())

describe('once the highlighter has answered', () => {
  it('keeps the id the block was given', async () => {
    const dom = await mount(
      <HighlightedCode node={codeNode([{ name: 'lang', value: 'javascript' }])} ctx={{}} keyProp="k" id="block-one">
        const x = 42
      </HighlightedCode>,
    )
    expect(dom.querySelector('.shiki')).not.toBeNull()
    expect(dom.querySelector('#block-one')).not.toBeNull()
  })

  it('still shows the caption', async () => {
    const dom = await mount(
      <HighlightedCode
        node={codeNode([
          { name: 'lang', value: 'javascript' },
          { name: 'caption', value: 'Example' },
        ])}
        ctx={{}}
        keyProp="k"
      >
        const x = 42
      </HighlightedCode>,
    )
    expect(dom.querySelector('.shiki')).not.toBeNull()
    expect(dom.querySelector('.code-block .caption')?.textContent).toBe('Example')
  })
})

describe('a block with no language declared', () => {
  it('never asks the highlighter for anything', async () => {
    await mount(
      <HighlightedCode node={codeNode([])} ctx={{}} keyProp="k">
        const x = 42
      </HighlightedCode>,
    )
    expect(themed).not.toHaveBeenCalled()
  })

  it('is the only case that stays quiet, a declared language still highlights', async () => {
    await mount(
      <HighlightedCode node={codeNode([{ name: 'lang', value: 'javascript' }])} ctx={{}} keyProp="k">
        const x = 42
      </HighlightedCode>,
    )
    expect(themed).toHaveBeenCalledTimes(1)
  })
})
