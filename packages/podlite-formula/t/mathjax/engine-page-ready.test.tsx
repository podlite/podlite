/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { Tex2ChtmlWithProvider } from '../../src/MathJax'
import { drawn, mount, runEngine, scriptById, settle } from './stand'

it('shows the source of the formula the start of MathJax failed, and draws the next one', async () => {
  window.MathJax = { startup: { pageReady: () => Promise.reject(new Error('the application did not start')) } }
  const first = mount(<Tex2ChtmlWithProvider latex="a" />)
  runEngine(scriptById('mathjax-script'), 'chtml')
  await settle(() => first.host.textContent === 'a', 'the source of the first formula')
  const next = mount(<Tex2ChtmlWithProvider latex="b" />)
  await settle(() => drawn(next.host), 'the next formula')
})
