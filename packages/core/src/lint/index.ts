import type { Violation, LintContext } from './types'
import { makeSyntaxViolation } from './rules/syntax-valid'
import { DEFAULT_RULES } from './rules'
import { runRules } from './engine'
import { detectFileType, readFile, parseContent } from './loader'
import { formatText, FileReport } from './formatters/text'
import { formatJson } from './formatters/json'
import { scanSourceRules } from './grammar/scan'

export type LintFormat = 'text' | 'json'

export type LintOptions = {
  strict: boolean
  format: LintFormat
  configPath?: string
  stdinContent?: string
}

// text handed to the command instead of a path is reported under this name
export const STDIN_NAME = '<stdin>'

function lintSource(content: string, filePath: string): Violation[] {
  const violations: Violation[] = [...scanSourceRules(content)]
  const fileType = detectFileType(filePath)
  try {
    const ast = parseContent(content, fileType)
    const ctx: LintContext = { filePath, fileType, config: {} }
    violations.push(...runRules(ast, DEFAULT_RULES, ctx))
  } catch (e) {
    violations.push(makeSyntaxViolation(e, filePath))
  }
  return violations
}

function lintFile(filePath: string): Violation[] {
  let content: string
  try {
    content = readFile(filePath)
  } catch (e) {
    return [
      {
        rule: 'io',
        severity: 'error',
        message: `Cannot read file: ${(e as Error).message}`,
      },
    ]
  }
  return lintSource(content, filePath)
}

export function runLint(files: string[], options: LintOptions): number {
  const reports: FileReport[] = files.map(filePath => ({ filePath, violations: lintFile(filePath) }))
  if (options.stdinContent !== undefined) {
    reports.push({ filePath: STDIN_NAME, violations: lintSource(options.stdinContent, STDIN_NAME) })
  }

  const output =
    options.format === 'json' ? formatJson(reports) : formatText(reports, { color: process.stdout.isTTY === true })
  if (output) process.stdout.write(output)

  const totals = reports.flatMap(r => r.violations)
  const hasError = totals.some(v => v.severity === 'error')
  const hasWarning = totals.some(v => v.severity === 'warning')
  if (hasError) return 1
  if (options.strict && hasWarning) return 1
  return 0
}
