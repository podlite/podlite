import { getFromTree, makeAttrs, PodliteDocument } from '@podlite/schema'
import type { Rule, Violation, LintContext } from '../types'

export const MEDIA_ABSOLUTE_FILE_RULE_ID = 'media-absolute-file'

const firstLine = (value: string): string =>
  value
    .split('\n')
    .map(line => line.trim())
    .find(line => line.length > 0) || ''

const pictureSource = (node: { config?: unknown; content?: unknown }): string => {
  const attrs = makeAttrs(node)
  if (attrs.exists('src')) return String(attrs.getFirstValue('src'))
  const content = Array.isArray(node.content) ? node.content : []
  for (const child of content) {
    if (child && typeof (child as { value?: unknown }).value === 'string') {
      const line = firstLine((child as { value: string }).value)
      if (line) return line
    }
  }
  return ''
}

const isAbsoluteLocal = (src: string): boolean => {
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):(.*)$/.exec(src)
  if (scheme) return scheme[1].toLowerCase() === 'file' && scheme[2].startsWith('/')
  return src.startsWith('/')
}

export const mediaAbsoluteFileRule: Rule = {
  id: MEDIA_ABSOLUTE_FILE_RULE_ID,
  severity: 'info',
  check: (ast: PodliteDocument, _ctx: LintContext): Violation[] => {
    const pictures = getFromTree(ast, node => {
      const n = node as { type?: string; name?: string }
      return n.type === 'block' && (n.name === 'picture' || n.name === 'Image')
    }) as Array<{ location?: Violation['location']; config?: unknown; content?: unknown }>
    const violations: Violation[] = []
    for (const node of pictures) {
      const src = pictureSource(node)
      if (src && isAbsoluteLocal(src)) {
        violations.push({
          rule: MEDIA_ABSOLUTE_FILE_RULE_ID,
          severity: 'info',
          message: `Absolute local image path "${src}". A published site cannot resolve it; use a relative path with an export base, or a full https: URL`,
          location: node.location,
        })
      }
    }
    return violations
  },
}
