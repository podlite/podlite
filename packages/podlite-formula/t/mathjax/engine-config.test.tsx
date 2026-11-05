/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { Tex2ChtmlWithProvider } from '../../src/MathJax'
import { drawn, mount, runEngine, scriptById, settle } from './stand'

it('loads MathJax when the application set only its configuration, and the configuration works', async () => {
  window.MathJax = { tex: { macros: { RR: '\\mathbb{R}' } } }
  const macro = mount(<Tex2ChtmlWithProvider latex={'\\RR'} />)
  const written = mount(<Tex2ChtmlWithProvider latex={'\\mathbb{R}'} />)
  runEngine(scriptById('mathjax-script'), 'chtml')
  await settle(() => drawn(macro.host) && drawn(written.host), 'both formulas')
  const math = (host: HTMLElement) => host.querySelector('mjx-math')?.outerHTML
  expect(math(macro.host)).toBe(math(written.host))
})
