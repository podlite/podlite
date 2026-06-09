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

export const extractPlainAndDecorations = (
  nodes: unknown,
): { plain: string; decorations: Decoration[] } => {
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

export interface HighlightedCodeProps {
  node: any
  children: React.ReactNode
  keyProp: string
  ctx: any
}

const HighlightedCode: React.FC<HighlightedCodeProps> = React.memo(({ node, children, keyProp, ctx }) => {
  const conf = makeAttrs(node, ctx)
  const caption = conf.exists('caption') ? conf.getFirstValue('caption') : null
  const lang = conf.getFirstValue('lang') || 'txt'

  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const highlight = async () => {
      try {
        const isDark = document.body.className.toLowerCase().includes('dark')
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

  return html ? (
    <>
      <code key={keyProp} className="shiki" dangerouslySetInnerHTML={{ __html: html }} />
      {caption && <div className="caption">{caption}</div>}
    </>
  ) : (
    <>
      <pre>
        <code key={keyProp}>{children}</code>
      </pre>
      {caption && <div className="caption">{caption}</div>}
    </>
  )
})

export default HighlightedCode
