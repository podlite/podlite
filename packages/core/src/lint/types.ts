import type { Location, PodliteDocument } from '@podlite/schema'
import type { Sources } from '../assemble'

export type Severity = 'error' | 'warning' | 'info'

export type FileType = 'md' | 'podlite'

export type RuleSetting = 'off' | Severity

export type LintConfig = {
  rules?: Record<string, RuleSetting>
}

// The name a report carries when the document came from a pipe: there is no
// directory to resolve a relative path against.
export const STDIN_NAME = '<stdin>'

export type LintContext = {
  filePath: string
  fileType: FileType
  config: LintConfig
  // the document as written: a rule that asks what the source says, not what
  // the tree kept, needs it — a reference can be consumed while the tree is
  // built. Optional, so a caller that builds a context by hand keeps working
  source?: string
  // set only when the document was read from the file named by filePath: a rule
  // that reads files next to it has nothing to read for text handed in by name
  fromDisk?: boolean
  // where included text comes from when the document is not read from disk: a
  // host that holds the files itself gives them here, with what the paths in
  // the document are resolved from and the name of the document among them
  sources?: Sources
  context?: unknown
  self?: string
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
