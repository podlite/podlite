import { EditorView, keymap } from '@codemirror/view'
import type { Extension } from '@codemirror/state'

// Regex: =item with optional level digit(s) + separator
const itemRe = /^(\s*=item)(\d*)([ \t])/

// Detect list type prefix at start of content
const prefixRe = /^(\[ \]|\[x\]|\[X\]|#)\s*/

// Item is "empty" if content is nothing or only a type prefix
const emptyContentRe = /^(\[ \]|\[x\]|\[X\]|#)?\s*$/

// Parsed representation of an =item line
type ItemLine = {
  readonly indent: string // leading whitespace before "=item"
  readonly marker: string // e.g. "=item1", "=item2"
  readonly level: number // 1–6
  readonly separator: string // " " or "\t"
  readonly markerEnd: number // absolute doc position after "=itemN<sep>"
  readonly content: string // raw text after the marker
}

// Parse, Don't Validate — returns typed structure or null
function parseItemLine(lineText: string, lineFrom: number): ItemLine | null {
  const m = lineText.match(itemRe)
  if (!m) return null

  const prefix = m[1] ?? '' // "\s*=item"
  const digits = m[2] ?? '' // level digits, may be empty
  const sep = m[3] ?? ' ' // separator char

  const indent = prefix.slice(0, prefix.length - 5) // whitespace before "=item"
  const level = digits === '' ? 1 : parseInt(digits, 10)
  const marker = `${indent}=item${digits}`

  return {
    indent,
    marker,
    level,
    separator: sep,
    markerEnd: lineFrom + prefix.length + digits.length + sep.length,
    content: lineText.slice(prefix.length + digits.length + sep.length),
  }
}

// Get the prefix to insert for the new item (checked → unchecked, # → #, none → '')
function resolveNewPrefix(content: string): string {
  const m = content.trim().match(prefixRe)
  if (!m) return ''
  const prefix = m[1] ?? ''
  if (prefix === '[x]' || prefix === '[X]' || prefix === '[ ]') return '[ ] '
  if (prefix === '#') return '# '
  return ''
}

// ─── List Continuation on Enter ────────────────────────────────────────────

export const listContinuationKeymap: Extension = keymap.of([
  {
    key: 'Enter',
    run: (view: EditorView): boolean => {
      const { state } = view
      const { head, from, to } = state.selection.main

      // Only single cursor (no selection)
      if (from !== to) return false

      const line = state.doc.lineAt(head)
      const item = parseItemLine(line.text, line.from)
      if (!item) return false

      // Cursor inside marker → default
      if (head < item.markerEnd) return false

      const trimmedContent = item.content.trim()

      // Empty item (including prefix-only like "[ ]" or "#") → remove marker, exit list
      if (emptyContentRe.test(trimmedContent)) {
        view.dispatch({
          changes: { from: line.from, to: line.to, insert: '' },
          selection: { anchor: line.from },
        })
        return true
      }

      // Determine type prefix for new item
      const newPrefix = resolveNewPrefix(trimmedContent)

      // Split: text before cursor stays, text after → new =itemN [prefix]
      const textAfterCursor = line.text.slice(head - line.from)
      const newItem = `\n${item.marker} ${newPrefix}`

      view.dispatch({
        changes: {
          from: head,
          to: line.to,
          insert: newItem + textAfterCursor.trimStart(),
        },
        selection: {
          anchor: head + newItem.length,
        },
      })
      return true
    },
  },
])

// ─── Tab / Shift-Tab: change item level ────────────────────────────────────

const maxItemLevel = 6
const minItemLevel = 1

type LevelDelta = 1 | -1

const indentPerLevel = '  ' // 2 spaces per level

function changeItemLevel(view: EditorView, delta: LevelDelta): boolean {
  const { state } = view
  const { from, to } = state.selection.main

  const startLine = state.doc.lineAt(from)
  const endLine = state.doc.lineAt(to)

  const changes: Array<{ from: number; to: number; insert: string }> = []

  for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
    const line = state.doc.line(lineNum)
    const item = parseItemLine(line.text, line.from)
    if (!item) continue

    const newLevel = item.level + delta
    if (newLevel < minItemLevel || newLevel > maxItemLevel) continue

    // Adjust indentation: each level = 4 spaces
    const newIndent = delta === 1 ? item.indent + indentPerLevel : item.indent.slice(indentPerLevel.length)

    const oldMarkerLen = item.markerEnd - line.from
    const newMarker = `${newIndent}=item${newLevel}${item.separator}`

    changes.push({ from: line.from, to: line.from + oldMarkerLen, insert: newMarker })
  }

  if (changes.length === 0) return false

  view.dispatch({ changes })
  return true
}

export const itemLevelKeymap: Extension = keymap.of([
  {
    key: 'Tab',
    run: (view: EditorView): boolean => changeItemLevel(view, 1),
  },
  {
    key: 'Shift-Tab',
    run: (view: EditorView): boolean => changeItemLevel(view, -1),
  },
])
