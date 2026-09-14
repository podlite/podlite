import React, { useState, useEffect } from 'react'
import { isCovered, makeAttrs, maskText } from '@podlite/schema'
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

// Text a node hides reaches the highlighter masked, one mask character per character,
// so the decorations keep their places.
export const extractPlainAndDecorations = (
  nodes: unknown,
  hides: (node: unknown) => boolean = () => false,
): { plain: string; decorations: Decoration[] } => {
  const decorations: Decoration[] = []
  let plain = ''

  const walk = (input: unknown, covered = false): void => {
    if (input == null) return
    if (typeof input === 'string') {
      plain += covered ? maskText(input) : input
      return
    }
    if (Array.isArray(input)) {
      for (const child of input) walk(child, covered)
      return
    }
    covered = covered || hides(input)
    const node = input as {
      type?: string
      name?: string
      value?: string
      text?: string
      content?: unknown
    }
    if ((node.type === 'text' || node.type === 'verbatim') && typeof node.value === 'string') {
      plain += covered ? maskText(node.value) : node.value
      return
    }
    if (node.type === 'fcode' && typeof node.name === 'string') {
      const tagName = fcodeToTag[node.name] || 'span'
      const start = plain.length
      walk(node.content, covered)
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
      walk(node.content, covered)
    } else if (typeof node.text === 'string') {
      plain += covered ? maskText(node.text) : node.text
    }
  }

  walk(nodes)
  return { plain, decorations }
}

export type HighlightedCodeProps = {
  node: { content?: unknown; config?: unknown }
  children: React.ReactNode
  keyProp: string | number
  ctx: { config?: unknown; maskMode?: boolean; renderMode?: string } | undefined
  id?: string
  wrap?: 'pre-code' | 'block'
}

// Block wrapping is the default because it is the one that shows a caption:
// a caller that says nothing gets the caption rather than silently losing it.
const HighlightedCode: React.FC<HighlightedCodeProps> = React.memo(
  ({ node, children, keyProp, ctx, id, wrap = 'block' }) => {
    const conf = makeAttrs(node, ctx)
    const written = conf.exists('caption') ? String(conf.getFirstValue('caption')) : null
    const caption = written !== null && isCovered(node, ctx) ? maskText(written) : written
    const maskMode = ctx?.maskMode
    const renderMode = ctx?.renderMode
    const lang = conf.getFirstValue('lang')

    const [html, setHtml] = useState<string | null>(null)

    useEffect(() => {
      // what was highlighted for another mode must not stay on the page while the new
      // result is on its way, or after it fails
      setHtml(null)
      if (!lang) return
      let cancelled = false

      const highlight = async () => {
        try {
          const isDark =
            typeof document !== 'undefined' && document.body && document.body.className.toLowerCase().includes('dark')
          const { plain, decorations } = extractPlainAndDecorations(node.content, part =>
            isCovered(part, { maskMode, renderMode }),
          )
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
    }, [lang, node.content, maskMode, renderMode])

    // The id goes on whichever element the branch puts outermost, so a link to
    // the block keeps working once highlighting replaces the plain output.
    const codeBody = html ? (
      <code key={keyProp} id={id} className="shiki" dangerouslySetInnerHTML={{ __html: html }} />
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
