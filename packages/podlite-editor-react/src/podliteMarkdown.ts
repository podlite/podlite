import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { styleTags, tags as t } from '@lezer/highlight'
import { BLOCK_NAMES, isVerbatimBlock } from '@podlite/schema'
import type { Extension } from '@codemirror/state'

const directiveRe = /^=([A-Za-z][\w-]*)(.*)$/
// a directive may go on over the next lines, each opened by a bare `=`
const continuationRe = /^=(\s.*)$/
const nameRe = /^(\s+)([A-Za-z][\w-]*)/

const DIRECTIVE_WORDS = ['begin', 'end', 'for', 'config', 'alias']
const TAKES_A_NAME = new Set(['begin', 'end', 'for'])
const standard = (name: string): boolean =>
  DIRECTIVE_WORDS.includes(name) || (BLOCK_NAMES as readonly string[]).includes(name) || /^(head|item)\d*$/.test(name)

// SYNOPSIS and SEE-ALSO name a section of the document; Image and Diagram name
// a block the author brought in; the rest is a name nothing here knows
const nodeForName = (name: string): string => {
  if (standard(name)) return 'PodBlockName'
  if (/^[A-Z][A-Z][A-Z0-9_-]*$/.test(name)) return 'PodSemanticBlock'
  if (/^[A-Z][a-z][a-zA-Z0-9_-]*$/.test(name)) return 'PodCustomBlock'
  return 'PodUnknownBlock'
}

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
    { name: 'PodSemanticBlock' },
    { name: 'PodCustomBlock' },
    { name: 'PodUnknownBlock' },
    { name: 'PodAttrName' },
    { name: 'PodAttrValue' },
    { name: 'PodVerbatim' },
    { name: 'PodCodeMark' },
    ...codeNodeNames.map(name => ({ name })),
  ],
  props: [
    styleTags({
      // the same tags the stream highlighter gave these, so colours stay put
      PodKeyword: t.keyword,
      PodBlockName: t.operator,
      PodSemanticBlock: t.constant(t.variableName),
      PodCustomBlock: t.className,
      PodUnknownBlock: t.variableName,
      PodAttrName: t.attributeName,
      PodAttrValue: t.string,
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
      // a directive right under a line of text starts a block of its own,
      // it does not go on the paragraph above
      endLeaf(_cx: any, line: any) {
        return directiveRe.test(line.text) || continuationRe.test(line.text)
      },
      parse(cx: any, line: any) {
        const m = directiveRe.exec(line.text)
        const cont = m ? null : continuationRe.exec(line.text)
        if (!m && !cont) return false
        const start = cx.lineStart + line.pos
        const markerEnd = start + line.text.length
        const children = []
        let at = start
        let word = ''
        let blockName = ''
        let rest = ''
        if (cont) {
          children.push(cx.elt('PodKeyword', at, at + 1))
          at += 1
          rest = cont[1]
        } else {
          word = (m as RegExpExecArray)[1]
          rest = (m as RegExpExecArray)[2]
          // `=begin`, `=head1` and the like read as one word; a name of its own
          // keeps the `=` a keyword and takes its colour from what the name is
          if (standard(word)) {
            children.push(cx.elt('PodKeyword', at, at + 1 + word.length))
          } else {
            children.push(cx.elt('PodKeyword', at, at + 1))
            children.push(cx.elt(nodeForName(word), at + 1, at + 1 + word.length))
          }
          at += 1 + word.length
          const n = TAKES_A_NAME.has(word) ? nameRe.exec(rest) : null
          if (n) {
            blockName = n[2]
            children.push(cx.elt(nodeForName(blockName), at + n[1].length, at + n[0].length))
            at += n[0].length
            rest = rest.slice(n[0].length)
          }
        }
        for (const a of rest.matchAll(attrRe)) {
          const from = at + (a.index as number)
          children.push(cx.elt(a[0][0] === ':' ? 'PodAttrName' : 'PodAttrValue', from, from + a[0].length))
        }
        // a block that keeps its content as written: markdown must not read it.
        // `=begin markdown` is the exception — its content is markdown by definition
        if (word === 'begin' && blockName && blockName !== 'markdown' && isVerbatimBlock(blockName)) {
          const endRe = new RegExp(`^=end\\s+${blockName}\\b`)
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
// `codeLanguages` is a parameter so a test can hand in a list it loads itself
export const podliteTreeLang = (codeLanguages: any = languages): Extension =>
  markdown({
    base: markdownLanguage,
    codeLanguages,
    extensions: [podliteMarkdownExtension as any],
  })
