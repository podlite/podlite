import * as fs from 'fs'
import type { LintConfig, RuleSetting, Severity, Violation } from './types'

const SETTINGS: RuleSetting[] = ['off', 'error', 'warning', 'info']

export class ConfigError extends Error {}

export function readConfig(configPath?: string): LintConfig {
  if (!configPath) return {}

  let raw: string
  try {
    raw = fs.readFileSync(configPath, 'utf-8')
  } catch (e) {
    throw new ConfigError(`cannot read config ${configPath}: ${(e as Error).message}`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    throw new ConfigError(`cannot read config ${configPath}: ${(e as Error).message}`)
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ConfigError(`config ${configPath} must hold an object`)
  }

  const rules = (parsed as { rules?: unknown }).rules
  if (rules === undefined) return {}
  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) {
    throw new ConfigError(`config ${configPath}: "rules" must hold an object`)
  }

  const checked: Record<string, RuleSetting> = {}
  for (const [id, setting] of Object.entries(rules as Record<string, unknown>)) {
    // a mistyped setting would turn the rule off without a word, so it is an error
    if (typeof setting !== 'string' || !SETTINGS.includes(setting as RuleSetting)) {
      throw new ConfigError(
        `config ${configPath}: rule "${id}" is set to ${JSON.stringify(setting)}; use one of ${SETTINGS.join(', ')}`,
      )
    }
    checked[id] = setting as RuleSetting
  }
  return { rules: checked }
}

export const isRuleOff = (config: LintConfig, ruleId: string): boolean => config.rules?.[ruleId] === 'off'

export function applyConfig(violations: Violation[], config: LintConfig): Violation[] {
  const rules = config.rules
  if (!rules) return violations
  const out: Violation[] = []
  for (const violation of violations) {
    const setting = rules[violation.rule]
    if (setting === 'off') continue
    out.push(setting ? { ...violation, severity: setting as Severity } : violation)
  }
  return out
}
