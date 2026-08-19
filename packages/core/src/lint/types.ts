import type { Location, PodliteDocument } from '@podlite/schema'

export type Severity = 'error' | 'warning' | 'info'

export type FileType = 'md' | 'podlite'

export type RuleSetting = 'off' | Severity

export type LintConfig = {
  rules?: Record<string, RuleSetting>
}

export type LintContext = {
  filePath: string
  fileType: FileType
  config: LintConfig
}

export type Violation = {
  rule: string
  severity: Severity
  message: string
  location?: Location
}

export type Rule = {
  id: string
  severity: Severity
  check: (ast: PodliteDocument, ctx: LintContext) => Violation[]
}

export type SourceRule = {
  id: string
  severity: Severity
}
