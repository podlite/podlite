import * as fs from 'fs'
import * as path from 'path'
import { parse } from '@podlite/schema'
import type { Violation, FileType } from './types'
import { makeSyntaxViolation } from './rules/syntax-valid'

export type LintFormat = 'text' | 'json'

export type LintOptions = {
  strict: boolean
  format: LintFormat
  configPath?: string
}

function detectFileType(filePath: string): FileType {
  return path.extname(filePath).toLowerCase() === '.md' ? 'md' : 'podlite'
}

function formatTextLine(filePath: string, v: Violation): string {
  const line = v.location?.start?.line ?? 1
  const column = v.location?.start?.column ?? 1
  return `${filePath}:${line}:${column}: ${v.severity}: ${v.message} (${v.rule})`
}

function lintFile(filePath: string): Violation[] {
  const violations: Violation[] = []
  let content: string
  try {
    content = fs.readFileSync(filePath, 'utf-8')
  } catch (e) {
    violations.push({
      rule: 'io',
      severity: 'error',
      message: `Cannot read file: ${(e as Error).message}`,
    })
    return violations
  }
  const fileType = detectFileType(filePath)
  const podMode = fileType === 'md' ? 0 : 1
  try {
    parse(content, { podMode })
  } catch (e) {
    violations.push(makeSyntaxViolation(e, filePath))
  }
  return violations
}

export function runLint(files: string[], options: LintOptions): number {
  const all: Array<{ filePath: string; violations: Violation[] }> = []
  for (const filePath of files) {
    all.push({ filePath, violations: lintFile(filePath) })
  }

  if (options.format === 'json') {
    const payload = all.flatMap(r => r.violations.map(v => ({ file: r.filePath, ...v })))
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n')
  } else {
    for (const r of all) {
      for (const v of r.violations) {
        process.stdout.write(formatTextLine(r.filePath, v) + '\n')
      }
    }
  }

  const totals = all.flatMap(r => r.violations)
  const hasError = totals.some(v => v.severity === 'error')
  const hasWarning = totals.some(v => v.severity === 'warning')
  if (hasError) return 1
  if (options.strict && hasWarning) return 1
  return 0
}
