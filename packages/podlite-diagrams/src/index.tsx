import React from 'react'
import { useEffect, useRef, useState } from 'react'
import { Plugin, Plugins, makeAttrs, getSafeNodeId } from '@podlite/schema'
import mermaid from 'mermaid'

let i = 0

const Diagram = ({ chart, caption, id }: { chart: string; caption?: string; id?: string }) => {
  const inputEl = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setError(null)
    if (!chart.trim()) {
      if (inputEl.current) inputEl.current.innerHTML = ''
      return
    }
    mermaid.initialize({ securityLevel: 'loose', startOnLoad: false })
    mermaid
      .render('graph-div' + i++, chart)
      .then(({ svg }) => {
        if (!cancelled && inputEl.current) inputEl.current.innerHTML = svg
      })
      .catch(e => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [chart])

  return (
    <div className="diagram" id={id}>
      {error ? <div className="mermaid error">{error}</div> : <div className="mermaid" ref={inputEl} />}
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
