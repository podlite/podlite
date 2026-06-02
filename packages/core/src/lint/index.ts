export type LintFormat = 'text' | 'json'

export type LintOptions = {
  strict: boolean
  format: LintFormat
  configPath?: string
}

export function runLint(files: string[], options: LintOptions): number {
  console.log(
    `lint: stub — received ${files.length} file(s); rules not yet implemented (format=${options.format}, strict=${options.strict})`,
  )
  return 0
}
