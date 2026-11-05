import * as fs from 'fs'
import * as path from 'path'
import * as React from 'react'
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'

Reflect.set(global, 'IS_REACT_ACT_ENVIRONMENT', true)

export type Output = 'chtml' | 'svg'
const fileOf: { [kind in Output]: string } = { chtml: 'tex-chtml-full.js', svg: 'tex-svg.js' }
export const engineFile = (kind: Output) =>
  path.join(path.dirname(require.resolve('mathjax/es5/tex-svg.js')), fileOf[kind])

// runs the bundle the way a browser runs the script, then reports the script loaded
export const runEngine = (script: HTMLScriptElement, kind: Output) =>
  act(() => {
    Object.defineProperty(document, 'currentScript', { configurable: true, value: script })
    try {
      window.eval(fs.readFileSync(engineFile(kind), 'utf8'))
    } finally {
      Reflect.deleteProperty(document, 'currentScript')
    }
    script.dispatchEvent(new Event('load'))
  })

export const failScript = (script: HTMLScriptElement) => act(() => void script.dispatchEvent(new Event('error')))

export const scripts = () => Array.from(document.querySelectorAll('script'))

export const scriptById = (id: string): HTMLScriptElement => {
  const found = document.getElementById(id)
  if (!(found instanceof HTMLScriptElement)) throw new Error(`no script ${id}`)
  return found
}

// a script the application put on the page itself
export const appScript = (id: string, kind: Output): HTMLScriptElement => {
  const script = document.createElement('script')
  script.id = id
  script.src = `https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/${fileOf[kind]}`
  document.head.appendChild(script)
  return script
}

export const mount = (element: React.ReactElement) => {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  act(() => root.render(element))
  return {
    host,
    rerender: (next: React.ReactElement) => act(() => root.render(next)),
    unmount: () => {
      act(() => root.unmount())
      host.remove()
    },
  }
}

// lets promises and timers run until the condition holds
export const settle = async (until: () => boolean, what: string) => {
  for (let step = 0; step < 300; step++) {
    if (until()) return
    await act(() => new Promise<void>(resolve => setTimeout(resolve, 10)))
  }
  throw new Error(`never came: ${what}`)
}

export const drawn = (host: HTMLElement) => host.querySelector('mjx-container') !== null
