/**
 * @jest-environment jsdom
 */

// The stub in jest.config.js resolves `mermaid` to a module that renders an
// empty diagram, so every case puts its own module in front of it. React has to
// come from the same registry as the component, or its hooks are null.
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
const SVG = '<svg id="drawn" />'

describe('handlers are bound to the diagram that was drawn', () => {
  beforeEach(() => jest.resetModules())
  afterEach(() => jest.dontMock('mermaid'))

  it('binds once, to the container the svg went into', async () => {
    // the assertions live outside the spy: anything thrown inside would be
    // swallowed by the component
    const seen: { arg: Element | null; html: string }[] = []
    jest.doMock('mermaid', () => ({
      __esModule: true,
      default: {
        initialize: () => {},
        render: async () => ({
          svg: SVG,
          bindFunctions: (el: Element) => seen.push({ arg: el, html: el.innerHTML }),
        }),
      },
    }))
    const host = await mountFresh(CHART)
    const container = host.querySelector('div.mermaid')
    expect(seen).toHaveLength(1)
    expect(seen[0].arg).toBe(container)
    expect(seen[0].html).toContain('id="drawn"')
  })

  it('draws a module that brings no binding', async () => {
    jest.doMock('mermaid', () => ({
      __esModule: true,
      default: { initialize: () => {}, render: async () => ({ svg: SVG }) },
    }))
    const host = await mountFresh(CHART)
    expect(host.innerHTML).toContain('id="drawn"')
    expect(host.querySelector('div.mermaid.error')).toBeNull()
  })

  it('keeps the diagram when binding throws, and still calls it', async () => {
    const calls: number[] = []
    jest.doMock('mermaid', () => ({
      __esModule: true,
      default: {
        initialize: () => {},
        render: async () => ({
          svg: SVG,
          bindFunctions: () => {
            calls.push(1)
            throw new Error('binding failed')
          },
        }),
      },
    }))
    const host = await mountFresh(CHART)
    expect(calls).toHaveLength(1)
    expect(host.innerHTML).toContain('id="drawn"')
    expect(host.querySelector('div.mermaid.error')).toBeNull()
  })

  it('binds once per drawing, not once more on a redraw', async () => {
    const calls: number[] = []
    jest.doMock('mermaid', () => ({
      __esModule: true,
      default: {
        initialize: () => {},
        render: async () => ({ svg: SVG, bindFunctions: () => calls.push(1) }),
      },
    }))
    const React = (await import('react')).default
    const { createRoot } = await import('react-dom/client')
    const { act } = await import('react-dom/test-utils')
    const Diagram = (await import('../src/index')).default
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(React.createElement(Diagram, { chart: CHART }))
    })
    expect(calls).toHaveLength(1)
    await act(async () => {
      root.render(React.createElement(Diagram, { chart: 'graph TD; C-->D' }))
    })
    expect(calls).toHaveLength(2)
  })
})
