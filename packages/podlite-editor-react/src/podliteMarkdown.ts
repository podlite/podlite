import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { styleTags, tags as t } from '@lezer/highlight'
import { parser as mdParser } from '@lezer/markdown'
import { BLOCK_NAMES, isVerbatimBlock } from '@podlite/schema'
import type { EditorState, Extension } from '@codemirror/state'

const directiveRe = /^=([A-Za-z][\w-]*)(.*)$/
// a directive may go on over the next lines, each opened by a bare `=`
const continuationRe = /^=(\s.*)$/
const nameRe = /^(\s+)([A-Za-z][\w-]*)/

// `=Markdown` with a capital letter is the old spelling, still met in documents
const isMarkdownName = (name: string): boolean => /^markdown$/i.test(name)

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

// every markup code the grammar accepts, coloured by what it turns into when
// the document is rendered: K and T are typed text like C, R names a stand-in
// value, H and J stand above and below the line, N and X leave a mark for the
// reader rather than text
const CODE_TAGS: Record<string, any> = {
  A: t.variableName,
  B: t.strong,
  C: t.monospace,
  D: t.definition(t.variableName),
  E: t.escape,
  F: t.literal,
  G: t.comment,
  H: t.annotation,
  I: t.emphasis,
  J: t.annotation,
  K: t.monospace,
  L: t.link,
  N: t.meta,
  O: t.strikethrough,
  R: t.variableName,
  S: t.content,
  T: t.monospace,
  U: t.labelName,
  V: t.content,
  W: t.link,
  X: t.meta,
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

// L and W carry two parts: what the reader sees and where it points
const SPLIT_CODES = new Set(['L', 'W'])

// reads the codes standing between two places in the text
const readCodesIn = (cx: any, src: string, from: number, to: number, offset: number): any[] => {
  const found = []
  for (let i = from; i < to; ) {
    const inner = readCode(cx, src, i, offset)
    if (inner) {
      found.push(inner)
      i = inner.to - offset
    } else i++
  }
  return found
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
  const bar = SPLIT_CODES.has(letter) ? topLevelBar(src, bodyFrom, end, open) : -1
  if (bar === -1) {
    children.push(...readCodesIn(cx, src, bodyFrom, end, offset))
  } else {
    children.push(...readCodesIn(cx, src, bodyFrom, bar, offset))
    children.push(cx.elt('PodCodeMark', offset + bar, offset + bar + 1))
    children.push(cx.elt('PodCodeTarget', offset + bar + 1, offset + end, readCodesIn(cx, src, bar + 1, end, offset)))
  }
  children.push(cx.elt('PodCodeMark', offset + end, offset + end + closingFor(open).length))
  return cx.elt(`PodCode${letter}`, offset + at, offset + end + closingFor(open).length, children)
}

// the bar that splits the body, the one outside any code nested in it
const topLevelBar = (src: string, from: number, to: number, open: string): number => {
  for (let i = from; i < to; ) {
    const nested = openerAt(src, i)
    if (nested) {
      const end = matchingEnd(src, i + 1 + nested.length, nested)
      if (end !== -1) {
        i = end + closingFor(nested).length
        continue
      }
    }
    if (src[i] === '|') return i
    i++
  }
  return -1
}

export const podliteMarkdownExtension: any = {
  defineNodes: [
    { name: 'PodDirective', block: true },
    {
      name: 'PodMarkdownBody',
      block: true,
      // 1 — the body of a delimited block, it runs up to its closing marker;
      // 0 — the body of an abbreviated one, it runs to a blank line or the next directive
      composite: (_cx: any, line: any, value: number) =>
        value ? !/^\s*=end\s+markdown\b/i.test(line.text) : !!line.text.trim() && !/^\s*=/.test(line.text),
    },
    { name: 'PodKeyword' },
    { name: 'PodBlockName' },
    { name: 'PodSemanticBlock' },
    { name: 'PodCustomBlock' },
    { name: 'PodUnknownBlock' },
    { name: 'PodAttrName' },
    { name: 'PodAttrValue' },
    { name: 'PodVerbatim' },
    { name: 'PodCodeMark' },
    { name: 'PodCodeTarget' },
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
      PodCodeTarget: t.url,
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
        const text = line.text.slice(line.pos)
        const m = directiveRe.exec(text)
        const cont = m ? null : continuationRe.exec(text)
        if (!m && !cont) return false
        const start = cx.lineStart + line.pos
        const markerEnd = cx.lineStart + line.text.length
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
        if (word === 'begin' && blockName && !isMarkdownName(blockName) && isVerbatimBlock(blockName)) {
          const endRe = new RegExp(`^\\s*=end\\s+${blockName}\\b`)
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
        // the body of a markdown block is markdown; it gets a node of its own so
        // the editor can tell from the tree that the caret stands inside one
        const opensBody =
          (word === 'begin' && isMarkdownName(blockName)) || (!cont && !TAKES_A_NAME.has(word) && isMarkdownName(word))
        if (opensBody && cx.line) {
          cx.startComposite('PodMarkdownBody', cx.line.pos, word === 'begin' ? 1 : 0)
          return null
        }
        return true
      },
    },
  ],
}

export type SuggestionContext = 'pod6' | 'md'

// the tree already knows where the caret stands, so nothing is parsed a second time
export const suggestionContextAt = (state: EditorState, pos: number): SuggestionContext => {
  // the tree may not have reached the caret yet; give the parse a moment to get there
  const tree = ensureSyntaxTree(state, pos, 100) || syntaxTree(state)
  // both sides, so a caret at the very start or the very end of the body counts as inside
  for (const side of [-1, 1] as const)
    for (let node: any = tree.resolveInner(pos, side); node; node = node.parent)
      if (node.name === 'PodMarkdownBody') return 'md'
  return 'pod6'
}

// the same question answered on a piece of text, for callers that hold no editor state
export const suggestionContextForLine = (text: string, line: number): SuggestionContext => {
  const tree = mdParser.configure(podliteMarkdownExtension).parse(text)
  const from = lineStartOf(text, line)
  const nl = text.indexOf('\n', from)
  const to = nl === -1 ? text.length : nl
  let found: SuggestionContext = 'pod6'
  // the body starts past the indent, so the line is measured by overlap
  tree.iterate({
    enter: n => {
      if (n.name === 'PodMarkdownBody' && n.from <= to && from < n.to) found = 'md'
    },
  })
  return found
}

const lineStartOf = (text: string, line: number): number => {
  let at = 0
  for (let n = 1; n < line; n++) {
    const next = text.indexOf('\n', at)
    if (next === -1) return at
    at = next + 1
  }
  return at
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
