import type { Violation } from '../types'

export type FileReport = { filePath: string; violations: Violation[] }

export type JsonDiagnostic = Violation & { file: string }

export function formatJson(reports: FileReport[]): string {
  const payload: JsonDiagnostic[] = reports.flatMap(r => r.violations.map(v => ({ file: r.filePath, ...v })))
  return JSON.stringify(payload, null, 2) + '\n'
}
