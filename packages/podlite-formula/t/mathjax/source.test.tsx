/**
 * @jest-environment jsdom
 */
import * as crypto from 'crypto'
import * as fs from 'fs'
import { engineFile, Output, scriptById, scripts } from './stand'

// the module keeps the state of the script, so each test takes the package anew, React with it
type Fresh = {
  React: typeof import('react')
  createRoot: typeof import('react-dom/client').createRoot
  act: typeof import('react-dom/test-utils').act
  Podlite: typeof import('@podlite/to-jsx').default
  formula: typeof import('../../src')
  mathJax: typeof import('../../src/MathJax')
}
const fresh = (): Fresh => {
  const box: Fresh[] = []
  jest.isolateModules(() => {
    // the core registers the formula plugin of the package, which is this source here
    jest.doMock('@podlite/formula', () => jest.requireActual('../../src'))
    box.push({
      React: require('react'),
      createRoot: require('react-dom/client').createRoot,
      act: require('react-dom/test-utils').act,
      Podlite: require('@podlite/to-jsx').default,
      formula: require('@podlite/formula'),
      mathJax: require('../../src/MathJax'),
    })
  })
  return box[0]
}

const draw = (f: Fresh, element: React.ReactElement) => {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = f.createRoot(host)
  f.act(() => root.render(element))
  return {
    host,
    unmount: () => {
      f.act(() => root.unmount())
      host.remove()
    },
  }
}

const failScript = (f: Fresh) => f.act(async () => void scriptById('mathjax-script').dispatchEvent(new Event('error')))
const hashOf = (kind: Output) =>
  `sha384-${crypto
    .createHash('sha384')
    .update(fs.readFileSync(engineFile(kind)))
    .digest('base64')}`
const MARKUP = '<img src=x onerror=alert(1)><svg onload=alert(2)>&'

beforeAll(() => {
  Reflect.set(global, 'IS_REACT_ACT_ENVIRONMENT', true)
})

afterEach(() => {
  document.body.innerHTML = ''
  scripts().forEach(script => script.remove())
  Reflect.deleteProperty(window, 'MathJax')
})

describe('the script of MathJax', () => {
  for (const kind of ['chtml', 'svg'] as const)
    it(`loads ${kind} from MathJax 3.2.2 with the hash of that file`, () => {
      const f = fresh()
      const Component = kind === 'chtml' ? f.mathJax.Tex2ChtmlWithProvider : f.mathJax.Tex2SVGWithProvider
      draw(f, f.React.createElement(Component, { latex: 'x' }))
      const script = scriptById('mathjax-script')
      expect(script.src).toBe(
        `https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/${kind === 'chtml' ? 'tex-chtml-full' : 'tex-svg'}.js`,
      )
      expect(script.getAttribute('integrity')).toBe(hashOf(kind))
      expect(script.getAttribute('crossorigin')).toBe('anonymous')
    })

  it('comes from the source the application sets', () => {
    const f = fresh()
    f.formula.setMathJaxSource({ chtml: { src: 'https://example.org/mj.js', integrity: 'sha384-own' } })
    draw(f, f.React.createElement(f.mathJax.Tex2ChtmlWithProvider, { latex: 'x' }))
    expect(scriptById('mathjax-script').src).toBe('https://example.org/mj.js')
    expect(scriptById('mathjax-script').getAttribute('integrity')).toBe('sha384-own')
  })

  it('carries no hash of another file when the source names none', () => {
    const f = fresh()
    f.formula.setMathJaxSource({ chtml: { src: 'https://example.org/a.js', integrity: 'sha384-a' } })
    f.formula.setMathJaxSource({ chtml: { src: 'https://example.org/b.js' } })
    draw(f, f.React.createElement(f.mathJax.Tex2ChtmlWithProvider, { latex: 'x' }))
    expect(scriptById('mathjax-script').src).toBe('https://example.org/b.js')
    expect(scriptById('mathjax-script').hasAttribute('integrity')).toBe(false)
  })

  it('stays as it is when the source is set after the script went in', () => {
    const f = fresh()
    draw(f, f.React.createElement(f.mathJax.Tex2ChtmlWithProvider, { latex: 'x' }))
    f.formula.setMathJaxSource({ chtml: { src: 'https://example.org/late.js' } })
    draw(f, f.React.createElement(f.mathJax.Tex2ChtmlWithProvider, { latex: 'y' }))
    expect(scripts()).toHaveLength(1)
    expect(scriptById('mathjax-script').src).toContain('mathjax@3.2.2')
  })

  it('takes the SVG source the application sets and leaves the CHTML one alone', () => {
    const f = fresh()
    f.formula.setMathJaxSource({ svg: { src: 'https://example.org/svg.js' } })
    draw(f, f.React.createElement(f.mathJax.Tex2SVGWithProvider, { latex: 'x' }))
    expect(scriptById('mathjax-script').src).toBe('https://example.org/svg.js')
    expect(scriptById('mathjax-script').hasAttribute('integrity')).toBe(false)
    scriptById('mathjax-script').remove()
    const g = fresh()
    g.formula.setMathJaxSource({ svg: { src: 'https://example.org/svg.js' } })
    draw(g, g.React.createElement(g.mathJax.Tex2ChtmlWithProvider, { latex: 'x' }))
    expect(scriptById('mathjax-script').getAttribute('integrity')).toBe(hashOf('chtml'))
  })

  it('takes the hash and the cross origin mode given to the provider', () => {
    const f = fresh()
    draw(
      f,
      f.React.createElement(f.formula.MathJaxProvider, {
        src: 'https://example.org/prop.js',
        integrity: 'sha384-prop',
        crossOrigin: 'use-credentials',
      }),
    )
    expect(scriptById('mathjax-script').getAttribute('integrity')).toBe('sha384-prop')
    expect(scriptById('mathjax-script').getAttribute('crossorigin')).toBe('use-credentials')
  })

  it('comes from the provider before the source set for the package', () => {
    const f = fresh()
    f.formula.setMathJaxSource({ chtml: { src: 'https://example.org/set.js', integrity: 'sha384-set' } })
    draw(f, f.React.createElement(f.formula.MathJaxProvider, { src: 'https://example.org/prop.js' }))
    expect(scriptById('mathjax-script').src).toBe('https://example.org/prop.js')
    expect(scriptById('mathjax-script').hasAttribute('integrity')).toBe(false)
  })
})

describe('a formula whose script failed', () => {
  const cases: Array<[string, (f: Fresh) => React.ReactElement, string, string]> = [
    [
      'a block',
      f => f.React.createElement(f.mathJax.Tex2ChtmlWithProvider, { latex: MARKUP, id: 'f' }),
      'DIV',
      'formula',
    ],
    [
      'an inline one',
      f => f.React.createElement(f.mathJax.Tex2ChtmlWithProvider, { latex: MARKUP, id: 'f', inline: true }),
      'SPAN',
      'f-code',
    ],
    [
      'an SVG one',
      f => f.React.createElement(f.mathJax.Tex2SVGWithProvider, { latex: MARKUP, id: 'f', className: 'formula' }),
      'SPAN',
      'formula',
    ],
  ]
  for (const [label, element, tag, className] of cases)
    it(`shows its source as text: ${label}`, async () => {
      const f = fresh()
      const { host } = draw(f, element(f))
      await failScript(f)
      const box = host.firstElementChild
      expect(box?.tagName).toBe(tag)
      expect(box?.className).toBe(className)
      expect(box?.id).toBe('f')
      expect(box?.textContent).toBe(MARKUP)
      expect(box?.children).toHaveLength(0)
    })

  it('shows its source at once when drawn again, and the script is not added twice', async () => {
    const f = fresh()
    draw(f, f.React.createElement(f.mathJax.Tex2ChtmlWithProvider, { latex: 'x' })).unmount()
    await failScript(f)
    const { host } = draw(f, f.React.createElement(f.mathJax.Tex2ChtmlWithProvider, { latex: 'y^2' }))
    await f.act(async () => {})
    expect(host.textContent).toBe('y^2')
    expect(scripts()).toHaveLength(1)
  })

  it('keeps the frame, the id and the caption the plugin draws', async () => {
    const f = fresh()
    const text =
      '=begin pod\n=begin formula :caption<Area> :id<eq>\n\\pi r^2\n=end formula\n\nInline F<x^2> here.\n=end pod\n'
    const { host } = draw(f, f.React.createElement(f.Podlite, {}, text))
    await failScript(f)
    const frame = host.querySelector('div.formula#eq')
    expect(frame?.querySelector('div.formula')?.textContent).toBe('\\pi r^2\n')
    expect(frame?.querySelector('.caption')?.textContent).toBe('Area')
    expect(host.querySelector('span.f-code')?.textContent).toBe('x^2')
  })

  it('stays masked and loads no MathJax when the formula is hidden', () => {
    const f = fresh()
    const text = '=begin pod\n=begin formula :masked :caption<Area>\nab^2\n=end formula\n=end pod\n'
    const { host } = draw(f, f.React.createElement(f.Podlite, {}, text))
    const frame = host.querySelector('div.formula')
    expect(frame?.firstChild?.textContent).toBe(`${'\u2588'.repeat(4)}\n`)
    expect(frame?.querySelector('.caption')?.textContent).toBe('\u2588'.repeat(4))
    expect(scripts()).toHaveLength(0)
  })

  it('shows its source when the loader of a present engine fails', async () => {
    const f = fresh()
    window.MathJax = {
      version: '3.2.2',
      loader: { ready: () => Promise.reject(new Error('a component did not load')) },
    }
    const { host } = draw(f, f.React.createElement(f.mathJax.Tex2ChtmlWithProvider, { latex: 'q' }))
    await f.act(async () => {})
    expect(host.textContent).toBe('q')
    expect(scripts()).toHaveLength(0)
  })
})
