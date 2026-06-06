import { ConfigItem, PodNode, PodliteDocument } from '../types'

const HEAD_MAX_LEVEL = 6

const truthy = (v: unknown): boolean => v === true || v === 1 || v === '1' || v === 'true'

const isNumbered = (config: ConfigItem[] | undefined): boolean | null => {
  if (!Array.isArray(config)) return null
  let result: boolean | null = null
  for (const entry of config) {
    if (!entry || entry.name !== 'numbered') continue
    const value = entry.value
    if (value === false || value === 0 || value === '0' || value === 'false') {
      result = false
    } else {
      result = truthy(value) ? true : value !== undefined ? Boolean(value) : true
    }
  }
  return result
}

const formatPrefix = (counter: number[], level: number): string => {
  const segments: string[] = []
  let started = false
  for (let i = 1; i <= level; i++) {
    const value = counter[i]
    if (!started && value === 0) continue
    started = true
    segments.push(String(value))
  }
  if (segments.length === 0) segments.push(String(counter[level]))
  return segments.join('.') + '.'
}

const walk = (node: PodNode, counter: number[]): void => {
  if (Array.isArray(node)) {
    for (const child of node) walk(child as PodNode, counter)
    return
  }
  if (!node || typeof node !== 'object') return
  const anyNode = node as {
    type?: string
    name?: string
    level?: string | number
    config?: ConfigItem[]
    content?: unknown
    numberPrefix?: string
  }
  if (anyNode.type === 'block' && anyNode.name === 'head' && anyNode.level !== undefined && anyNode.level !== null) {
    const level = Number(anyNode.level)
    if (Number.isFinite(level) && level >= 1 && level <= HEAD_MAX_LEVEL) {
      for (let i = level + 1; i <= HEAD_MAX_LEVEL; i++) counter[i] = 0
      const numbered = isNumbered(anyNode.config)
      if (numbered === true) {
        counter[level] = (counter[level] || 0) + 1
        anyNode.numberPrefix = formatPrefix(counter, level)
      } else if (numbered === false) {
        delete anyNode.numberPrefix
      }
    }
  }
  if (anyNode.content !== undefined) {
    walk(anyNode.content as PodNode, counter)
  }
}

export const attachHeadingNumberPrefix = <T extends PodliteDocument | PodNode>(ast: T): T => {
  const counter: number[] = new Array(HEAD_MAX_LEVEL + 1).fill(0)
  walk(ast as PodNode, counter)
  return ast
}

export default attachHeadingNumberPrefix
