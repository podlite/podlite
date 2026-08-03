import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { styleTags, tags as t } from '@lezer/highlight'
import { BLOCK_NAMES, isVerbatimBlock } from '@podlite/schema'
import type { Extension } from '@codemirror/state'

const directiveRe = new RegExp(
  `^(=(?:begin|end|for|config|alias|${BLOCK_NAMES.join(
    '|',
  )}|head\\d*|item\\d*|[A-Z][A-Za-z0-9_-]*))(\\s+([\\w-]+))?(.*)$`,
)

// a value keeps its own delimiters; the norm has no square brackets since 2026-08
const attrRe = /:!?[\w-]+|<[^>]*>|\([^)]*\)|\{[^}]*\}|'[^']*'|"[^"]*"|｢[^｣]*｣/g

export const podliteMarkdownExtension: any = {
  defineNodes: [
    { name: 'PodDirective', block: true },
    { name: 'PodKeyword' },
    { name: 'PodBlockName' },
    { name: 'PodAttrName' },
    { name: 'PodAttrValue' },
    { name: 'PodVerbatim' },
  ],
  props: [
    styleTags({
      PodKeyword: t.keyword,
      PodBlockName: t.typeName,
      PodAttrName: t.attributeName,
      PodAttrValue: t.attributeValue,
      PodVerbatim: t.content,
    }),
  ],
  parseBlock: [
    {
      name: 'PodDirective',
      before: 'ATXHeading',
      parse(cx: any, line: any) {
        const m = directiveRe.exec(line.text)
        if (!m) return false
        const start = cx.lineStart + line.pos
        const markerEnd = start + line.text.length
        const children = []
        let at = start
        children.push(cx.elt('PodKeyword', at, at + m[1].length))
        at += m[1].length
        if (m[2]) {
          const nameStart = at + (m[2].length - m[3].length)
          children.push(cx.elt('PodBlockName', nameStart, nameStart + m[3].length))
          at += m[2].length
        }
        for (const a of (m[4] || '').matchAll(attrRe)) {
          const from = at + (a.index as number)
          children.push(cx.elt(a[0][0] === ':' ? 'PodAttrName' : 'PodAttrValue', from, from + a[0].length))
        }
        // a block that keeps its content as written: markdown must not read it.
        // `=begin markdown` is the exception — its content is markdown by definition
        if (m[1] === '=begin' && m[3] && m[3] !== 'markdown' && isVerbatimBlock(m[3])) {
          const endRe = new RegExp(`^=end\\s+${m[3]}\\b`)
          cx.nextLine()
          while (cx.line && !endRe.test(cx.line.text)) if (!cx.nextLine()) break
          const to = cx.line ? cx.lineStart + cx.line.text.length : markerEnd
          if (to > markerEnd) children.push(cx.elt('PodVerbatim', markerEnd, to))
          cx.addElement(cx.elt('PodDirective', start, to, children))
          cx.nextLine()
          return true
        }
        cx.addElement(cx.elt('PodDirective', start, markerEnd, children))
        cx.nextLine()
        return true
      },
    },
  ],
}

// Podlite read on top of the markdown parser: the content of a markdown block
// and the code inside a fence get their own highlighting for free
export const podliteTreeLang = (): Extension =>
  markdown({
    base: markdownLanguage,
    codeLanguages: languages,
    extensions: [podliteMarkdownExtension as any],
  })
