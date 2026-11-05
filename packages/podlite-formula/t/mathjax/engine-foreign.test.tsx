/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { Tex2ChtmlWithProvider } from '../../src/MathJax'
import { appScript, drawn, mount, runEngine, scripts, settle } from './stand'

it('waits for a script of MathJax the page already has, without a handler of its own', async () => {
  const app = appScript('mathjax-script', 'chtml')
  expect(app.onload).toBeNull()
  const formula = mount(<Tex2ChtmlWithProvider latex="x" />)
  runEngine(app, 'chtml')
  await settle(() => drawn(formula.host), 'the formula')
  expect(scripts()).toHaveLength(1)
})
