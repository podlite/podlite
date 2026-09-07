import React from 'react'
import { useEffect, useRef, useState } from 'react'
import { Plugin, Plugins, makeAttrs, getSafeNodeId } from '@podlite/schema'

let i = 0

// Mermaid is loaded on first render rather than at import time: a document
// without a diagram must not pay for it. Its shape is described here instead of
// imported, so the package type-checks the same way whether or not the module
// resolves.
type MermaidApi = {
  initialize: (config: { securityLevel: string; startOnLoad: boolean }) => void
  // bindFunctions attaches the listeners a diagram declares; mermaid marks it
  // optional, and a diagram without handlers comes back without it
  render: (id: string, chart: string) => Promise<{ svg: string; bindFunctions?: (element: Element) => void }>
}

// Mermaid publishes a default export, so the namespace itself carries nothing
// useful; both functions have to be callable on what `default` holds.
const isMermaidApi = (m: unknown): m is MermaidApi =>
  typeof m === 'object' &&
  m !== null &&
  typeof (m as MermaidApi).initialize === 'function' &&
  typeof (m as MermaidApi).render === 'function'

// A rejected import and an unusable module are the same event to the caller:
// drawing is unavailable, and the block falls back to the source text.
const loadMermaid = async (): Promise<MermaidApi> => {
  const module: unknown = await import('mermaid')
  const api = (module as { default?: unknown })?.default ?? module
  if (!isMermaidApi(api)) throw new Error('mermaid is not available')
  return api
}

const Diagram = ({ chart, caption, id }: { chart: string; caption?: string; id?: string }) => {
  const inputEl = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    setError(null)
    setUnavailable(false)
    if (!chart.trim()) {
      if (inputEl.current) inputEl.current.innerHTML = ''
      return
    }
    const draw = async () => {
      let mermaid: MermaidApi
      try {
        mermaid = await loadMermaid()
      } catch {
        if (!cancelled) setUnavailable(true)
        return
      }
      // the load is awaited, so the component may already be gone by now
      if (cancelled) return
      try {
        mermaid.initialize({ securityLevel: 'loose', startOnLoad: false })
        const { svg, bindFunctions } = await mermaid.render('graph-div' + i++, chart)
        if (cancelled) return
        // one container for both steps: the ref may point elsewhere by the
        // time the second line runs
        const container = inputEl.current
        if (!container) return
        container.innerHTML = svg
        try {
          bindFunctions?.(container)
        } catch {
          // a diagram without its handlers still reads; an empty box does not,
          // so a failed binding must not reach the error branch
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    }
    void draw()
    return () => {
      cancelled = true
    }
  }, [chart])

  return (
    <div className="diagram" id={id}>
      {unavailable ? (
        <pre className="mermaid source">{chart}</pre>
      ) : error ? (
        <div className="mermaid error">{error}</div>
      ) : (
        <div className="mermaid" ref={inputEl} />
      )}
      {caption ? <div className="caption">{caption}</div> : null}
    </div>
  )
}

export const plugin: Plugin = {
  toJSX: helper => () => (node, ctx, interator) => {
    const conf = makeAttrs(node, ctx)
    const caption = conf.exists('caption') ? conf.getFirstValue('caption') : null
    const id = getSafeNodeId(node, ctx)
    return helper(
      ({ children, key }) => {
        return <Diagram key={key} id={id} caption={caption} chart={node.content[0]?.value ?? ''} />
      },
      node,
      interator(node.content, { ...ctx }),
    )
  },
}
export const PluginRegister: Plugins = {
  Diagram: plugin, // TODO: deprecate it
  Mermaid: plugin,
}
export default Diagram
