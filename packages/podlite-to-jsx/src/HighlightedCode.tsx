import React, { useState, useEffect } from 'react'
import { makeAttrs } from '@podlite/schema'
import { codeToThemedHtml } from './shiki'

type Decoration = {
  start: number
  end: number
  tagName: string
  properties?: { class?: string }
}

const fcodeToTag: Record<string, string> = {
  B: 'strong',
  I: 'em',
  C: 'code',
  U: 'u',
  K: 'kbd',
}

export const extractPlainAndDecorations = (nodes: unknown): { plain: string; decorations: Decoration[] } => {
  const decorations: Decoration[] = []
  let plain = ''

  const walk = (input: unknown): void => {
    if (input == null) return
    if (typeof input === 'string') {
      plain += input
      return
    }
    if (Array.isArray(input)) {
      for (const child of input) walk(child)
      return
    }
    const node = input as {
      type?: string
      name?: string
      value?: string
      text?: string
      content?: unknown
    }
    if (node.type === 'text' && typeof node.value === 'string') {
      plain += node.value
      return
    }
    if (node.type === 'verbatim' && typeof node.value === 'string') {
      plain += node.value
      return
    }
    if (node.type === 'fcode' && typeof node.name === 'string') {
      const tagName = fcodeToTag[node.name] || 'span'
      const start = plain.length
      walk(node.content)
      const end = plain.length
      if (end > start) {
        decorations.push({
          start,
          end,
          tagName,
          properties: { class: `fc-${node.name}` },
        })
      }
      return
    }
    if (node.content !== undefined) {
      walk(node.content)
    } else if (typeof node.text === 'string') {
      plain += node.text
    }
  }

  walk(nodes)
  return { plain, decorations }
}

export type HighlightedCodeProps = {
  node: { content?: unknown; config?: unknown }
  children: React.ReactNode
  keyProp: string | number
  ctx: unknown
  id?: string
  wrap?: 'pre-code' | 'block'
}

const HighlightedCode: React.FC<HighlightedCodeProps> = React.memo(
  ({ node, children, keyProp, ctx, id, wrap = 'pre-code' }) => {
    const conf = makeAttrs(node, ctx)
    const caption = conf.exists('caption') ? conf.getFirstValue('caption') : null
    const lang = conf.getFirstValue('lang')

    const [html, setHtml] = useState<string | null>(null)

    useEffect(() => {
      if (!lang) return
      let cancelled = false

      const highlight = async () => {
        try {
          const isDark =
            typeof document !== 'undefined' && document.body && document.body.className.toLowerCase().includes('dark')
          const { plain, decorations } = extractPlainAndDecorations(node.content)
          const result = await codeToThemedHtml({
            code: plain,
            language: lang,
            theme: isDark ? 'dark' : 'light',
            decorations,
          })
          if (!cancelled) setHtml(result)
        } catch (e) {
          console.error('[podlite] shiki highlight error:', e)
        }
      }

      highlight()
      return () => {
        cancelled = true
      }
    }, [lang, node.content])

    const codeBody = html ? (
      <code key={keyProp} className="shiki" dangerouslySetInnerHTML={{ __html: html }} />
    ) : (
      <pre key={`${keyProp}-pre`} id={id}>
        <code key={keyProp}>{children}</code>
      </pre>
    )

    if (wrap === 'block') {
      return (
        <div className="code-block" key={`${keyProp}-code-div`}>
          {codeBody}
          {caption ? (
            <div key={`${keyProp}-caption`} className="caption">
              {caption}
            </div>
          ) : null}
        </div>
      )
    }

    return codeBody
  },
)

HighlightedCode.displayName = 'HighlightedCode'

export default HighlightedCode
