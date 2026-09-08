import * as fs from 'fs'
import * as path from 'path'
import type { LintConfig, RuleSetting, Severity, Violation } from './types'
import { createRequire } from 'module'

const SETTINGS: RuleSetting[] = ['off', 'error', 'warning', 'info']

const CONFIG_NAMES = ['.podlitelintrc.json', '.podlitelintrc.js']

export class ConfigError extends Error {}

// Nearest config at or above the given directory. The first name of CONFIG_NAMES
// present in a directory wins; a directory closer to the file wins over one above.
export function findConfig(startDir: string): string | undefined {
  let dir = path.resolve(startDir)
  for (;;) {
    for (const name of CONFIG_NAMES) {
      const candidate = path.join(dir, name)
      if (fs.existsSync(candidate)) return candidate
    }
    const up = path.dirname(dir)
    if (up === dir) return undefined
    dir = up
  }
}

export function readConfig(configPath?: string): LintConfig {
  if (!configPath) return {}

  if (configPath.endsWith('.js')) return readJsConfig(configPath)

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

  return checkConfigShape(parsed, configPath)
}

function readJsConfig(configPath: string): LintConfig {
  let loaded: unknown
  const resolved = path.resolve(configPath)
  try {
    // The same source is built for both module systems, and one of them has no
    // require at all. This builds one that works in either, anchored at the config
    // itself, and keeps the load synchronous so readConfig stays synchronous too.
    loaded = createRequire(resolved)(resolved)
  } catch (e) {
    throw new ConfigError(`cannot read config ${configPath}: ${(e as Error).message}`)
  }
  const value = (loaded as { default?: unknown })?.default ?? loaded
  return checkConfigShape(value, configPath)
}

function checkConfigShape(parsed: unknown, configPath: string): LintConfig {
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

// Flags stand above the file: they are typed for this run and mean it.
export function applyRuleFlags(config: LintConfig, enable: string[], disable: string[]): LintConfig {
  if (enable.length === 0 && disable.length === 0) return config
  const rules = { ...(config.rules || {}) }
  for (const id of disable) rules[id] = 'off'
  for (const id of enable) delete rules[id]
  return { ...config, rules }
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
