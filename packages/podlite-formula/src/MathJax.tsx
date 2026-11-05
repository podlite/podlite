import React, { createContext, useContext, useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    MathJax: { [key: string]: any }
  }
}

export type MathJaxSource = { src: string; integrity?: string; crossOrigin?: string }
type Output = 'chtml' | 'svg'

export type ContextProps = {
  options?: {}
  src?: string
  integrity?: string
  crossOrigin?: string
  children?: React.ReactNode
}

const CDN = 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/'
let sources: { [kind in Output]: MathJaxSource } = {
  chtml: {
    src: `${CDN}tex-chtml-full.js`,
    integrity: 'sha384-NR8saakDju74wZ6sprPPhEoWbaP3iVtXVJH12mRSiaIgxMdi33mOQj8bnF2WxzY3',
    crossOrigin: 'anonymous',
  },
  svg: {
    src: `${CDN}tex-svg.js`,
    integrity: 'sha384-KKWa9jJ1MZvssLeOoXG6FiOAZfAgmzsIIfw8BXwI9+kYm0lPCbC6yTQPBC00F1/L',
    crossOrigin: 'anonymous',
  },
}

// a source is replaced whole, so a hash never passes to another file
export const setMathJaxSource = (next: { [kind in Output]?: MathJaxSource }) => {
  sources = { chtml: next.chtml ?? sources.chtml, svg: next.svg ?? sources.svg }
}

type ScriptState = 'idle' | 'loading' | 'loaded' | 'failed'
let scriptState: ScriptState = 'idle'
const listeners = new Set<() => void>()
const moveTo = (state: ScriptState) => {
  scriptState = state
  listeners.forEach(listener => listener())
}
const listen = (script: HTMLElement) => {
  script.addEventListener('load', () => moveTo('loaded'))
  script.addEventListener('error', () => moveTo('failed'))
  moveTo('loading')
}

// once loaded, MathJax puts itself in place of the configuration object
const engine = () => (typeof window.MathJax?.version === 'string' ? window.MathJax : null)

const loadScript = (source: MathJaxSource) => {
  if (scriptState !== 'idle') return
  if (engine()) return moveTo('loaded')
  const present = document.getElementById('mathjax-script') ?? document.getElementById('MathJax-script')
  if (present) return listen(present)
  if (!window.MathJax) {
    window.MathJax = {
      tex: {
        inlineMath: [],
        displayMath: [],
      },
      options: {
        enableMenu: false,
      },
      startup: {
        elements: null,
        typeset: false,
      },
    }
  }
  const script = document.createElement('script')
  script.id = 'mathjax-script'
  script.src = source.src
  if (source.integrity) script.setAttribute('integrity', source.integrity)
  if (source.crossOrigin) script.crossOrigin = source.crossOrigin
  script.async = true
  listen(script)
  document.head.appendChild(script)
}

const converterOf: { [kind in Output]: string } = { chtml: 'tex2chtml', svg: 'tex2svgPromise' }
const engineFor = async (kind: Output, state: ScriptState): Promise<Window['MathJax'] | 'wait' | 'fail'> => {
  const found = engine()
  if (!found) return state === 'loaded' || state === 'failed' ? 'fail' : 'wait'
  if (typeof found[converterOf[kind]] !== 'function') await found.loader?.ready?.()
  const ready = engine()
  return ready && typeof ready[converterOf[kind]] === 'function' ? ready : 'fail'
}

const reportFailure = (latex: string, error: unknown) =>
  console.error(`[podlite/formula] shown as source: ${latex}`, error)

const MathJaxContext = createContext<ScriptState>('idle')

export function useTexSVG({
  latex = '',
  onSuccess = (html: HTMLElement) => {},
  onError = (html: HTMLElement) => {},
} = {}): [HTMLElement | null, { error: boolean; isLoading: boolean; failed: boolean }] {
  const state = useContext(MathJaxContext)
  const [html, setHtml] = useState<HTMLElement | null>(null)
  // a failure belongs to the formula it happened on
  const [failedOn, setFailedOn] = useState<string | null>(null)
  const failed = failedOn === latex
  const [isLoading, setIsLoading] = useState(false)
  const settled = useRef<string | null>(null)
  const error = !!html?.outerHTML.match(/data-mjx-error/)

  useEffect(() => {
    let cancelled = false
    async function setMathJaxHTML() {
      if (settled.current === latex) return
      const found = await engineFor('svg', state)
      if (cancelled || found === 'wait') return
      settled.current = latex
      if (found === 'fail') return setFailedOn(latex)
      setIsLoading(true)
      const mathJaxElement: HTMLElement = await found.tex2svgPromise(latex)
      if (!cancelled) setHtml(mathJaxElement)
    }

    setMathJaxHTML()
      .catch(e => {
        reportFailure(latex, e)
        if (!cancelled) setFailedOn(latex)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [state, latex])

  useEffect(() => {
    if (html && error) onError(html)
    if (html && !error) onSuccess(html)
  }, [html])

  return [html, { error, isLoading, failed }]
}

export type Tex2SVGProps = { [key: string]: any } & {
  latex: string
  onError?: (html: HTMLElement) => void
  onSuccess?: (html: HTMLElement) => void
  inline?: boolean
}
export const Tex2SVG: React.FC<Tex2SVGProps> = ({
  latex = '',
  onError = (html: HTMLElement) => {},
  onSuccess = (html: HTMLElement) => {},
  ...props
}) => {
  const ref = useRef<HTMLElement | null>(null)
  const [html, { error, failed }] = useTexSVG({ latex, onError, onSuccess })

  useEffect(() => {
    if (html && !error) {
      Object.keys(props).map(key => html.setAttribute(key, props[key]))
      ref.current?.appendChild(html)
      return () => {
        ref.current?.removeChild(html)
      }
    }

    return () => {}
  }, [props, html])

  if (failed) return <span {...props}>{latex}</span>
  return <span ref={ref} />
}

const SourceProvider = ({ sourceOf, children }: { sourceOf: () => MathJaxSource; children?: React.ReactNode }) => {
  const [state, setState] = useState(scriptState)

  useEffect(() => {
    const listener = () => setState(scriptState)
    listeners.add(listener)
    loadScript(sourceOf())
    setState(scriptState)
    return () => {
      listeners.delete(listener)
    }
  }, [])
  return <MathJaxContext.Provider value={state}>{children}</MathJaxContext.Provider>
}

export const Tex2SVGWithProvider: React.FC<Tex2SVGProps> = props => (
  <SourceProvider sourceOf={() => sources.svg}>
    <Tex2SVG {...props} />
  </SourceProvider>
)

export const MathJaxProvider: React.FC<ContextProps> = ({ src, integrity, crossOrigin, children = null }) => (
  <SourceProvider sourceOf={() => (src ? { src, integrity, crossOrigin } : sources.chtml)}>{children}</SourceProvider>
)

export function useTexChtml({
  latex = '',
  inline = false,
  onSuccess = (html: HTMLElement) => {},
  onError = (html: HTMLElement) => {},
} = {}): [HTMLElement | null, { error: boolean; isLoading: boolean; failed: boolean }] {
  const state = useContext(MathJaxContext)
  const [html, setHtml] = useState<HTMLElement | null>(null)
  // a failure belongs to the formula it happened on
  const [failedOn, setFailedOn] = useState<string | null>(null)
  const failed = failedOn === latex
  const [isLoading, setIsLoading] = useState(false)
  const settled = useRef<string | null>(null)
  const error = !!html?.outerHTML.match(/data-mjx-error/)

  useEffect(() => {
    let cancelled = false
    async function setMathJaxHTML() {
      if (settled.current === latex) return
      const found = await engineFor('chtml', state)
      if (cancelled || found === 'wait') return
      settled.current = latex
      if (found === 'fail') return setFailedOn(latex)
      setIsLoading(true)
      let produced = false
      await typeset(() => {
        if (cancelled) return
        setHtml(found.tex2chtml(latex, { display: !inline }))
        produced = true
      }).catch(e => {
        if (!produced) throw e
      })
    }

    setMathJaxHTML()
      .catch(e => {
        reportFailure(latex, e)
        if (!cancelled) setFailedOn(latex)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [state, latex])

  useEffect(() => {
    if (html && error) onError(html)
    if (html && !error) onSuccess(html)
  }, [html])

  return [html, { error, isLoading, failed }]
}

export const Tex2Chtml: React.FC<Tex2SVGProps> = ({
  latex = '',
  inline = false,
  className = inline ? 'f-code' : 'formula',
  onError = (html: HTMLElement) => {},
  onSuccess = (html: HTMLElement) => {},
  ...props
}) => {
  const ref = useRef<HTMLElement | null>(null)
  const [html, { error, failed }] = useTexChtml({ latex, onError, onSuccess, inline })
  useEffect(() => {
    if (html && !error) {
      Object.keys(props).map(key => html.setAttribute(key, props[key]))
      ref.current?.appendChild(html)
      return () => {
        ref.current?.removeChild(html)
      }
    }

    return () => {}
  }, [props, html])
  if (failed) return React.createElement(inline ? 'span' : 'div', { ...props, className }, latex)
  return React.createElement(inline ? 'span' : 'div', {
    className,
    ref: ref,
  })
}

export const Tex2ChtmlWithProvider: React.FC<Tex2SVGProps> = props => (
  <SourceProvider sourceOf={() => sources.chtml}>
    <Tex2Chtml {...props} />
  </SourceProvider>
)

// formulas wait in the queue of MathJax, and the queue goes on after a failure
function typeset(code: () => void): Promise<void> {
  const mathJax = window.MathJax
  const queue: Promise<void> = mathJax.startup?.promise ?? Promise.resolve()
  const done = queue.then(() => {
    code()
    return mathJax.typesetPromise?.()
  })
  if (mathJax.startup)
    mathJax.startup.promise = done.catch((err: Error) => console.log(`[formula] typeset error: ${err.message}`))
  return done
}

export default Tex2SVGWithProvider
