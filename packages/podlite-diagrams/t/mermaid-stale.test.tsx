/**
 * @jest-environment jsdom
 */

// While a redraw is in flight the previous diagram must be hidden but still
// occupy its space. Each case drives the render promise by hand to catch the
// component mid-flight.
const CHART = 'graph TD; A-->B'
const OLD = '<svg id="old" />'
const NEW = '<svg id="new" />'

const setup = async (render: () => Promise<{ svg: string }>) => {
  jest.doMock('mermaid', () => ({
    __esModule: true,
    default: { initialize: () => {}, render },
  }))
  const React = (await import('react')).default
  const { createRoot } = await import('react-dom/client')
  const { act } = await import('react-dom/test-utils')
  const Diagram = (await import('../src/index')).default
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  return { React, act, Diagram, host, root }
}

describe('a stale diagram is hidden but keeps its place', () => {
  beforeEach(() => jest.resetModules())
  afterEach(() => jest.dontMock('mermaid'))

  it('hides the previous diagram while the new one is drawn, without dropping it', async () => {
    let release: ((v: { svg: string }) => void) | null = null
    let first = true
    const { React, act, Diagram, host, root } = await setup(() => {
      if (first) {
        first = false
        return Promise.resolve({ svg: OLD })
      }
      return new Promise(r => {
        release = r
      })
    })
    await act(async () => {
      root.render(React.createElement(Diagram, { chart: CHART }))
    })
    const box = host.querySelector('div.mermaid') as HTMLElement
    expect(box.innerHTML).toContain('id="old"')

    await act(async () => {
      root.render(React.createElement(Diagram, { chart: 'graph TD; C-->D' }))
    })
    // mid-flight: hidden, and the old markup is still there holding the space
    expect(box.style.visibility).toBe('hidden')
    expect(box.innerHTML).toContain('id="old"')

    await act(async () => {
      release!({ svg: NEW })
    })
    expect(box.style.visibility).toBe('')
    expect(box.innerHTML).toContain('id="new"')
  })

  it('does not leave the box hidden when drawing fails', async () => {
    const { React, act, Diagram, host, root } = await setup(async () => {
      throw new Error('bad chart')
    })
    await act(async () => {
      root.render(React.createElement(Diagram, { chart: CHART }))
    })
    expect(host.querySelector('div.mermaid.error')).not.toBeNull()
    expect(host.querySelector('div.mermaid[style*="hidden"]')).toBeNull()
  })

  it('does not leave the box hidden when the module is unavailable', async () => {
    jest.doMock('mermaid', () => {
      throw new Error('module missing')
    })
    const React = (await import('react')).default
    const { createRoot } = await import('react-dom/client')
    const { act } = await import('react-dom/test-utils')
    const Diagram = (await import('../src/index')).default
    const host = document.createElement('div')
    document.body.appendChild(host)
    await act(async () => {
      createRoot(host).render(React.createElement(Diagram, { chart: CHART }))
    })
    expect(host.querySelector('pre.mermaid.source')).not.toBeNull()
    expect(host.querySelector('div.mermaid[style*="hidden"]')).toBeNull()
  })
})
