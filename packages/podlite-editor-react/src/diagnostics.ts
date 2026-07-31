import { linter, Diagnostic } from '@codemirror/lint'
import type { Extension } from '@codemirror/state'
import { podlite as podliteCore } from 'podlite'

export type ParseDiagnostic = {
  severity: 'warning'
  message: string
  location: { start: { offset: number; line: number }; end: { offset: number } }
}

// no plugins: the diagnostics come from the grammar, nothing downstream adds to them
const parser = podliteCore({ importPlugins: false })

let lastText: string | undefined
let lastResult: ParseDiagnostic[] = []

export const parseDiagnostics = (text: string): ParseDiagnostic[] => {
  if (text === lastText) return lastResult
  let found: ParseDiagnostic[] = []
  try {
    found = (parser.parse(text) as { diagnostics?: ParseDiagnostic[] }).diagnostics || []
  } catch {
    found = []
  }
  lastText = text
  lastResult = found
  return found
}

// A line being typed is not a mistake yet: `:k(` is an unfinished thought while
// the caret sits on it
export const toEditorDiagnostics = (found: ParseDiagnostic[], caretLine: number): Diagnostic[] =>
  found
    .filter(d => d.location.start.line !== caretLine)
    .map(d => ({
      from: d.location.start.offset,
      to: d.location.end.offset,
      severity: d.severity,
      message: d.message,
      source: 'podlite',
    }))

export const podliteDiagnostics = (): Extension =>
  linter(
    view => {
      const text = view.state.doc.toString()
      const caretLine = view.state.doc.lineAt(view.state.selection.main.head).number
      return toEditorDiagnostics(parseDiagnostics(text), caretLine)
    },
    { delay: 750 },
  )
