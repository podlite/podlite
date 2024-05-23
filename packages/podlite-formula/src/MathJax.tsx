import React, { createContext, useContext, useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    MathJax: { [key: string]: any }
  }
}

export type ContextProps = {
  options?: {}
  src?: string
}
export function useTexChtml({
  latex = '',
  inline = false,
  onSuccess = (html: HTMLElement) => {},
  onError = (html: HTMLElement) => {},
} = {}): [HTMLElement | null, { error: boolean; isLoading: boolean }] {
  const mathJax: Window['MathJax'] | null = useContext(MathJaxContext) || null
  const [html, setHtml] = useState<HTMLElement | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const error = !!html?.outerHTML.match(/data-mjx-error/)

  useEffect(() => {
    async function setMathJaxHTML() {
      let cancelled = false
      const isReady = mathJax?.tex2chtml || (await mathJax?.loader?.ready?.())
      console.error(` before rtun ${latex}`)
      if (isReady) {
        try {
          setIsLoading(true)
          typeset(() => {
            if (cancelled) {
              return
            }

            const mathJaxElement = mathJax!.tex2chtml(latex, { display: !inline })
            setHtml(mathJaxElement)
          })
        } catch (e) {
          console.error('Something went really wrong, if this problem persists then please open an issue', e)
        } finally {
          setIsLoading(false)
        }
      }
    }
    console.error(` seteffect ${latex}`)
    setMathJaxHTML()
  }, [mathJax, latex])

  useEffect(() => {
    if (html && error) onError(html)
    if (html && !error) onSuccess(html)
  }, [html])

  return [html, { error, isLoading }]
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
  const [html, { error }] = useTexChtml({ latex, onError, onSuccess, inline })
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
  return React.createElement(inline ? 'span' : 'div', {
    className,
    ref: ref,
  })
}

export const Tex2ChtmlWithProvider: React.FC<Tex2SVGProps> = props => (
  <MathJaxProvider src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml-full.js">
    <Tex2Chtml {...props} />
  </MathJaxProvider>
)

declare var MathJax: {
  startup: {
    promise: Promise<void>
  }
  tex2chtml: (formula: string, options: { display: boolean }) => any
  typesetPromise: (promise: void | Promise<void>) => Promise<void>
}

function typeset(code: () => void | Promise<void>) {
  window.MathJax.startup.promise = MathJax.startup.promise
    .then(() => window.MathJax.typesetPromise(code()))
    .catch(err => console.log(`[formula] typeset error: ${err.message}`))
  return window.MathJax.startup.promise
}

export default Tex2SVGWithProvider
