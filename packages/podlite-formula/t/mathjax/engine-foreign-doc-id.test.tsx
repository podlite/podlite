/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { Tex2ChtmlWithProvider } from '../../src/MathJax'
import { appScript, drawn, mount, runEngine, scripts, settle } from './stand'

it('waits for the script named as the documentation of MathJax names it', async () => {
  const app = appScript('MathJax-script', 'chtml')
  const formula = mount(<Tex2ChtmlWithProvider latex="x" />)
  expect(scripts()).toHaveLength(1)
  runEngine(app, 'chtml')
  await settle(() => drawn(formula.host), 'the formula')
})
