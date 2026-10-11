/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'

const themed = jest.fn(async () => '<pre class="shiki"><code>const x = 42</code></pre>')
jest.mock('@podlite/highlight/lib/shiki', () => ({ codeToThemedHtml: () => themed() }))

import { TestPodlite as Podlite } from '../src/index'
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const mount = async (source: string): Promise<HTMLElement> => {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  await act(async () => {
    root.render(<Podlite>{source}</Podlite>)
  })
  const dom = host.cloneNode(true) as HTMLElement
  act(() => root.unmount())
  host.remove()
  return dom
}

describe('a folded code block once the highlighter has answered', () => {
  it('keeps the highlighted code and its caption inside the fold', async () => {
    const dom = await mount(
      '=begin pod\n=begin code :folded :lang<javascript> :caption<Example>\nconst x = 42\n=end code\n=end pod\n',
    )
    expect(themed).toHaveBeenCalled()
    const fold = dom.querySelector('details.folded')
    expect(fold).not.toBeNull()
    expect(fold.querySelector('.shiki')).not.toBeNull()
    expect(fold.querySelector('.caption')?.textContent).toBe('Example')
    expect(fold.querySelector('summary')?.textContent).toBe('Example')
  })
})
