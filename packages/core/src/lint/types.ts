import type { Location, PodliteDocument } from '@podlite/schema'

export type Severity = 'error' | 'warning' | 'info'

export type FileType = 'md' | 'podlite'

// Placeholder until the config schema is defined — narrow now to keep widening backwards-compatible.
export type LintConfig = Record<string, never>

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
