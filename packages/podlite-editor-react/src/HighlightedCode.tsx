import React, { useState, useEffect } from 'react'
import { getTextContentFromNode, makeAttrs } from '@podlite/schema'
import { codeToThemedHtml } from './shiki'

export interface HighlightedCodeProps {
  node: any
  children: React.ReactNode
  keyProp: string
  ctx: any
}

/**
 * This component handles async syntax highlighting
 */
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
        const result = await codeToThemedHtml({
          code: getTextContentFromNode(node.content),
          language: lang,
          theme: isDark ? 'dark' : 'light',
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
