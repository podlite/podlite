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

// markup codes the stream highlighter knew, with the same colour meaning
const CODE_TAGS: Record<string, any> = {
  A: t.variableName,
  B: t.strong,
  C: t.monospace,
  F: t.literal,
  G: t.comment,
  I: t.emphasis,
  L: t.link,
  O: t.strikethrough,
  U: t.labelName,
  Z: t.comment,
}
const CODE_LETTERS = Object.keys(CODE_TAGS)

const codeNodeNames = CODE_LETTERS.map(c => `PodCode${c}`)

const closingFor = (open: string): string => (open === '«' ? '»' : '>'.repeat(open.length))

const openerAt = (src: string, at: number): string | null => {
  if (!CODE_TAGS[src[at]]) return null
  if (src[at + 1] === '«') return '«'
  let open = ''
  let i = at + 1
  while (src[i] === '<') {
    open += '<'
    i++
  }
  return open || null
}

// a code ends at its matching bracket, so nested codes of the same width count
const matchingEnd = (src: string, bodyFrom: number, open: string): number => {
  const close = closingFor(open)
  let depth = 1
  let i = bodyFrom
  while (i < src.length) {
    const nested = openerAt(src, i)
    if (nested === open) {
      depth++
      i += 1 + open.length
      continue
    }
    if (src.startsWith(close, i)) {
      depth--
      if (!depth) return i
      i += close.length
      continue
    }
    i++
  }
  return -1
}

// reads one code at `at`; the body is scanned again so nested codes become children
const readCode = (cx: any, src: string, at: number, offset: number): any => {
  const open = openerAt(src, at)
  if (!open) return null
  const letter = src[at]
  const bodyFrom = at + 1 + open.length
  const end = matchingEnd(src, bodyFrom, open)
  if (end === -1) return null
  const children = [cx.elt('PodCodeMark', offset + at, offset + bodyFrom)]
  for (let i = bodyFrom; i < end; ) {
    const inner = readCode(cx, src, i, offset)
    if (inner) {
      children.push(inner)
      i = inner.to - offset
    } else i++
  }
  children.push(cx.elt('PodCodeMark', offset + end, offset + end + closingFor(open).length))
  return cx.elt(`PodCode${letter}`, offset + at, offset + end + closingFor(open).length, children)
}

export const podliteMarkdownExtension: any = {
  defineNodes: [
    { name: 'PodDirective', block: true },
    { name: 'PodKeyword' },
    { name: 'PodBlockName' },
    { name: 'PodAttrName' },
    { name: 'PodAttrValue' },
    { name: 'PodVerbatim' },
    { name: 'PodCodeMark' },
    ...codeNodeNames.map(name => ({ name })),
  ],
  props: [
    styleTags({
      PodKeyword: t.keyword,
      PodBlockName: t.typeName,
      PodAttrName: t.attributeName,
      PodAttrValue: t.attributeValue,
      PodVerbatim: t.content,
      PodCodeMark: t.processingInstruction,
      ...Object.fromEntries(CODE_LETTERS.map(c => [`PodCode${c}`, CODE_TAGS[c]])),
    }),
  ],
  parseInline: [
    {
      name: 'PodFormattingCode',
      before: 'Emphasis',
      parse(cx: any, next: number, pos: number) {
        const el = readCode(cx, cx.text, pos - cx.offset, cx.offset)
        return el ? cx.addElement(el) : -1
      },
    },
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
