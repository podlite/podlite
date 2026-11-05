/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { Tex2ChtmlWithProvider } from '../../src/MathJax'
import { appScript, drawn, mount, runEngine, settle } from './stand'

it('uses an engine the page loaded before and adds no script', async () => {
  runEngine(appScript('app-mathjax', 'chtml'), 'chtml')
  const formula = mount(<Tex2ChtmlWithProvider latex="x" />)
  await settle(() => drawn(formula.host), 'the formula')
  expect(document.getElementById('mathjax-script')).toBeNull()
})
