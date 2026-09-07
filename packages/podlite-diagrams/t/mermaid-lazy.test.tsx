/**
 * @jest-environment jsdom
 */

// Each case resets the module registry so a different `mermaid` can be put in
// front of the loader. React has to come from that same registry, or the
// component ends up with a second copy of it and its hooks are null.
const mountFresh = async (chart: string): Promise<HTMLElement> => {
  const React = (await import('react')).default
  const { createRoot } = await import('react-dom/client')
  const { act } = await import('react-dom/test-utils')
  const Diagram = (await import('../src/index')).default
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  await act(async () => {
    root.render(React.createElement(Diagram, { chart }))
  })
  return host
}

const CHART = 'graph TD; A-->B'

describe('mermaid is loaded on render, not on import', () => {
  beforeEach(() => jest.resetModules())
  afterEach(() => jest.dontMock('mermaid'))

  it('falls back to the source text when the module will not load', async () => {
    jest.doMock('mermaid', () => {
      throw new Error('module missing')
    })
    const host = await mountFresh(CHART)
    expect(host.querySelector('pre.mermaid.source')?.textContent).toBe(CHART)
    expect(host.textContent).not.toContain('module missing')
  })

  it('falls back when the module loads but carries no usable api', async () => {
    jest.doMock('mermaid', () => ({ __esModule: true, default: { nothing: true } }))
    const host = await mountFresh(CHART)
    expect(host.querySelector('pre.mermaid.source')?.textContent).toBe(CHART)
  })

  it('draws through a usable module and shows no fallback', async () => {
    jest.doMock('mermaid', () => ({
      __esModule: true,
      default: { initialize: () => {}, render: async () => ({ svg: '<svg id="ok" />' }) },
    }))
    const host = await mountFresh(CHART)
    expect(host.querySelector('pre.mermaid.source')).toBeNull()
    expect(host.innerHTML).toContain('<svg id="ok"')
  })

  it('reports a drawing error instead of the source text', async () => {
    jest.doMock('mermaid', () => ({
      __esModule: true,
      default: {
        initialize: () => {},
        render: async () => {
          throw new Error('bad chart')
        },
      },
    }))
    const host = await mountFresh(CHART)
    expect(host.querySelector('div.mermaid.error')?.textContent).toBe('bad chart')
    expect(host.querySelector('pre.mermaid.source')).toBeNull()
  })
})
