import type { Severity, Violation } from '../types'

export type FileReport = { filePath: string; violations: Violation[] }

export type TextFormatOptions = { color: boolean }

const ANSI = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
}

function colourize(severity: Severity, color: boolean): string {
  if (!color) return severity
  if (severity === 'error') return `${ANSI.red}${severity}${ANSI.reset}`
  if (severity === 'warning') return `${ANSI.yellow}${severity}${ANSI.reset}`
  return `${ANSI.cyan}${severity}${ANSI.reset}`
}

function plural(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}

function summaryLine(reports: FileReport[]): string {
  const totals = reports.flatMap(r => r.violations)
  const nFiles = reports.length
  const nErrors = totals.filter(v => v.severity === 'error').length
  const nWarnings = totals.filter(v => v.severity === 'warning').length
  return `${plural(nFiles, 'file', 'files')} checked, ${plural(nErrors, 'error', 'errors')}, ${plural(
    nWarnings,
    'warning',
    'warnings',
  )}`
}

export function formatText(reports: FileReport[], opts: TextFormatOptions): string {
  const lines: string[] = []
  for (const r of reports) {
    for (const v of r.violations) {
      const line = v.location?.start?.line ?? 1
      const column = v.location?.start?.column ?? 1
      lines.push(`${r.filePath}:${line}:${column}: ${colourize(v.severity, opts.color)}: ${v.message} (${v.rule})`)
    }
  }
  if (reports.length === 0) return ''
  if (lines.length === 0) return `${summaryLine(reports)}\n`
  return `${lines.join('\n')}\n\n${summaryLine(reports)}\n`
}
