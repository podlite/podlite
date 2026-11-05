/**
 * @jest-environment jsdom
 */
import * as React from 'react'
import { Tex2SVGWithProvider } from '../../src/MathJax'
import { drawn, failScript, mount, runEngine, scriptById, scripts, settle } from './stand'

const svg = (latex: string) => mount(<Tex2SVGWithProvider latex={latex} />)

it('shows the source of a formula whose extension did not load, and draws the next one', async () => {
  const first = svg('x')
  runEngine(scriptById('mathjax-script'), 'svg')
  await settle(() => drawn(first.host), 'the first formula')
  const source = '\\require{physics} \\abs{x}'
  const failed = svg(source)
  await settle(
    () => scripts().some(script => script.src.endsWith('/input/tex/extensions/physics.js')),
    'the script of the extension',
  )
  const extension = scripts().find(script => script.src.endsWith('/input/tex/extensions/physics.js'))
  if (extension) failScript(extension)
  await settle(() => failed.host.textContent === source, 'the source of the formula')
  const next = svg('y')
  await settle(() => drawn(next.host), 'the next formula')
  failed.rerender(<Tex2SVGWithProvider latex="v" />)
  await settle(() => drawn(failed.host), 'the formula written anew in the same place')
})
