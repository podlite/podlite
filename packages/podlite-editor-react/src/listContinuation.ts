import { EditorView, keymap } from '@codemirror/view'

// Regex: =item with optional level (1-10) + space
const ITEM_RE = /^(\s*=item\d*)\s/

// Detect list type prefix at start of content
const PREFIX_RE = /^(\[ \]|\[x\]|\[X\]|#)\s*/

// Get the prefix to use for new item (checked → unchecked, # → #, none → none)
function getNewPrefix(content: string): string {
  const m = content.match(PREFIX_RE)
  if (!m) return ''
  const prefix = m[1]
  // task list: always insert unchecked
  if (prefix === '[x]' || prefix === '[X]' || prefix === '[ ]') return '[ ] '
  // numbered list
  if (prefix === '#') return '# '
  return ''
}

// Item is "empty" if content is nothing or only a type prefix
const EMPTY_CONTENT_RE = /^(\[ \]|\[x\]|\[X\]|#)?\s*$/

export const listContinuationKeymap = keymap.of([
  {
    key: 'Enter',
    run: (view: EditorView): boolean => {
      const state = view.state
      const { head } = state.selection.main

      // Only single cursor (no selection)
      if (state.selection.main.from !== state.selection.main.to) return false

      const line = state.doc.lineAt(head)
      const match = line.text.match(ITEM_RE)
      if (!match) return false // not an =item line → default

      const marker = match[1] // "=item1", "=item2", etc.
      const markerEnd = line.from + match[0].length // position after "=itemN "

      // Cursor inside marker → default
      if (head < markerEnd) return false

      const contentAfterMarker = line.text.slice(match[0].length).trim()

      // Empty item (including prefix-only like "[ ]" or "#") → remove marker, exit list
      if (EMPTY_CONTENT_RE.test(contentAfterMarker)) {
        view.dispatch({
          changes: { from: line.from, to: line.to, insert: '' },
          selection: { anchor: line.from },
        })
        return true
      }

      // Determine type prefix for new item
      const newPrefix = getNewPrefix(contentAfterMarker)

      // Split: text before cursor stays, text after → new =itemN [prefix]
      const textAfterCursor = line.text.slice(head - line.from)
      const newItem = `\n${marker} ${newPrefix}`

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
