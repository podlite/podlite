import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Podlite } from '../src/index'

const render = (src: string) => renderToStaticMarkup(<Podlite>{src}</Podlite>)

let warn: jest.SpyInstance
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => warn.mockRestore())
const warnings = () => warn.mock.calls.map(c => String(c[0]))

describe('limits that keep a render off the stack limit', () => {
  it('shows an alias that expands into itself as written, and names the cycle', () => {
    const out = render('=alias X A<Y>\n=alias Y A<X>\n\nA<X>\n')
    expect(out).toContain('A&lt;X&gt;')
    expect(out).not.toContain('podlite-render-error')
    expect(warnings()).toEqual(['[to-jsx] alias X expands into itself: X → Y → X'])
  })

  it('holds 8 expansions of 31 levels each, the deepest render there is under the limits', () => {
    const w = (x: string) => 'B<'.repeat(31) + x + '>'.repeat(31)
    const src =
      Array.from({ length: 8 }, (_, i) => `=alias X${i} ${w(i === 7 ? 'x' : `A<X${i + 1}>`)}`).join('\n') +
      `\n\n${w('A<X0>')}\n`
    const out = render(src)
    expect(out).not.toContain('podlite-render-error')
    expect(out.split('<strong>').length - 1).toBe(9 * 31)
  })

  it('renders a thousand nested codes, the deeper ones as text', () => {
    const out = render('=para\n' + 'B<'.repeat(1000) + 'x' + '>'.repeat(1000) + '\n')
    expect(out).not.toContain('podlite-render-error')
    expect(out.split('<strong>').length - 1).toBe(32)
    expect(warnings().filter(w => w.includes('failed to render'))).toEqual([])
  })
})
