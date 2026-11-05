/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { Tex2ChtmlWithProvider, Tex2SVGWithProvider } from '../../src/MathJax'
import { drawn, mount, runEngine, scriptById, settle } from './stand'

const chtml = (latex: string) => mount(<Tex2ChtmlWithProvider latex={latex} />)

beforeAll(async () => {
  const first = chtml('x')
  runEngine(scriptById('mathjax-script'), 'chtml')
  await settle(() => drawn(first.host), 'the first formula')
})

it('draws what MathJax draws and leaves out what it marks as an error', async () => {
  const broken = chtml('\\frac{x}')
  const unknown = chtml('\\unknown')
  const plain = chtml('x^2')
  await settle(() => drawn(unknown.host) && drawn(plain.host), 'the formulas')
  expect(broken.host.textContent).toBe('')
  expect(drawn(broken.host)).toBe(false)
})

it('shows the source of a formula MathJax throws on, and draws the next one', async () => {
  const engine = window.MathJax
  const convert = engine.tex2chtml
  engine.tex2chtml = (latex: string, options: object) => {
    if (latex === 'boom') throw new Error('conversion failed')
    return convert(latex, options)
  }
  try {
    const failed = chtml('boom')
    await settle(() => failed.host.textContent === 'boom', 'the source of the formula')
    const next = chtml('y')
    await settle(() => drawn(next.host), 'the next formula')
    failed.rerender(<Tex2ChtmlWithProvider latex="v" />)
    await settle(() => drawn(failed.host), 'the formula written anew in the same place')
  } finally {
    engine.tex2chtml = convert
  }
})

it('shows the source of an SVG formula the engine cannot draw, and draws the next CHTML one', async () => {
  const svg = mount(<Tex2SVGWithProvider latex="z" />)
  await settle(() => svg.host.textContent === 'z', 'the source of the SVG formula')
  expect(drawn(svg.host)).toBe(false)
  const next = chtml('w')
  await settle(() => drawn(next.host), 'the next CHTML formula')
})
