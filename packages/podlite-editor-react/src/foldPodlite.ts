import { foldService } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'
import type { Extension } from '@codemirror/state'

type FoldRange = { from: number; to: number }

// =begin Name ... =end Name
const beginRe = /^(\s*)=begin\s+(\S+)/
const endRe = /^(\s*)=end\s+(\S+)/

// =headN (level 1-6)
const headRe = /^(\s*)=head(\d+)\s/

// Parse =begin line, return block name or null
function parseBeginLine(lineText: string): string | null {
  const m = lineText.match(beginRe)
  return m ? m[2] ?? null : null
}

// Fold =begin Name ... =end Name: fold from end of =begin line to start of =end line
function foldBeginEnd(state: EditorState, lineStart: number): FoldRange | null {
  const line = state.doc.lineAt(lineStart)
  const blockName = parseBeginLine(line.text)
  if (!blockName) return null

  // Search forward for matching =end
  for (let i = line.number + 1; i <= state.doc.lines; i++) {
    const candidate = state.doc.line(i)
    const m = candidate.text.match(endRe)
    if (m && m[2] === blockName) {
      // Fold from end of =begin line to start of =end line
      if (line.to >= candidate.from) return null
      return { from: line.to, to: candidate.from }
    }
  }

  return null
}

// Fold =headN: from end of heading line to start of next heading of same or higher level (or EOF)
function foldHeadSection(state: EditorState, lineStart: number): FoldRange | null {
  const line = state.doc.lineAt(lineStart)
  const m = line.text.match(headRe)
  if (!m) return null

  const level = parseInt(m[2] ?? '1', 10)

  // Search forward for next heading of same or higher level
  let foldEnd = state.doc.length
  for (let i = line.number + 1; i <= state.doc.lines; i++) {
    const candidate = state.doc.line(i)
    const hm = candidate.text.match(headRe)
    if (hm) {
      const candidateLevel = parseInt(hm[2] ?? '1', 10)
      if (candidateLevel <= level) {
        foldEnd = candidate.from
        break
      }
    }
  }

  // Nothing to fold if heading is last line or only whitespace follows
  if (line.to >= foldEnd) return null

  // Trim trailing blank lines from fold range
  let endPos = foldEnd
  while (endPos > line.to) {
    const prevLine = state.doc.lineAt(endPos - 1)
    if (prevLine.text.trim() !== '') {
      endPos = prevLine.to
      break
    }
    endPos = prevLine.from
  }

  if (line.to >= endPos) return null

  return { from: line.to, to: endPos }
}

export const podliteFoldService: Extension = foldService.of(
  (state: EditorState, lineStart: number): FoldRange | null =>
    foldBeginEnd(state, lineStart) ?? foldHeadSection(state, lineStart),
)
