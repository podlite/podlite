/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { Tex2ChtmlWithProvider } from '../../src/MathJax'
import { appScript, drawn, failScript, mount, runEngine, scriptById, settle } from './stand'

it('draws with an engine the application loads after the script of the package failed', async () => {
  const first = mount(<Tex2ChtmlWithProvider latex="a" />)
  failScript(scriptById('mathjax-script'))
  await settle(() => first.host.textContent === 'a', 'the source of the first formula')
  runEngine(appScript('app-mathjax', 'chtml'), 'chtml')
  const next = mount(<Tex2ChtmlWithProvider latex="b" />)
  await settle(() => drawn(next.host), 'the next formula')
  expect(document.querySelectorAll('#mathjax-script')).toHaveLength(1)
})
