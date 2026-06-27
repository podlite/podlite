import { ConfigItem, PodNode } from './types'

export type FallbackResolveResult = {
  resolved: string
  chain: string[]
}

export type ResolveOptions = {
  maxDepth?: number
  isTerminal?: (type: string) => boolean
}

export class FallbackCycleError extends Error {
  chain: string[]
  constructor(chain: string[]) {
    super(`fallback cycle detected: ${chain.join(' -> ')}`)
    Object.setPrototypeOf(this, FallbackCycleError.prototype)
    this.name = 'FallbackCycleError'
    this.chain = chain
  }
}

export class FallbackDepthError extends Error {
  chain: string[]
  constructor(chain: string[], maxDepth: number) {
    super(`fallback chain exceeds max depth ${maxDepth}: ${chain.join(' -> ')}`)
    Object.setPrototypeOf(this, FallbackDepthError.prototype)
    this.name = 'FallbackDepthError'
    this.chain = chain
  }
}

export class FallbackMissingTargetError extends Error {
  chain: string[]
  target: string
  constructor(chain: string[], target: string) {
    super(`fallback target not defined: ${target} (chain: ${chain.join(' -> ')})`)
    Object.setPrototypeOf(this, FallbackMissingTargetError.prototype)
    this.name = 'FallbackMissingTargetError'
    this.chain = chain
    this.target = target
  }
}

const DEFAULT_MAX_DEPTH = 8

const fallbackTarget = (config: ConfigItem[] | undefined): string | undefined => {
  if (!Array.isArray(config)) return undefined
  const item = config.find(c => c && c.name === 'fallback')
  return item && typeof item.value === 'string' ? item.value : undefined
}

export const collectFallbackMap = (ast: PodNode): Map<string, string> => {
  const map = new Map<string, string>()
  const walk = (node: PodNode): void => {
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (!node || typeof node !== 'object') return
    const anyNode = node as { type?: string; name?: string; config?: ConfigItem[]; content?: unknown }
    if (anyNode.type === 'config' && typeof anyNode.name === 'string') {
      const target = fallbackTarget(anyNode.config)
      if (target !== undefined) map.set(anyNode.name, target)
    }
    if (anyNode.content !== undefined) walk(anyNode.content as PodNode)
  }
  walk(ast)
  return map
}

export const resolveFallback = (
  startType: string,
  map: Map<string, string>,
  opts: ResolveOptions = {},
): FallbackResolveResult => {
  const maxDepth = opts.maxDepth ?? DEFAULT_MAX_DEPTH
  const isTerminal = opts.isTerminal
  const visited = new Set<string>()
  const chain: string[] = []
  let current = startType
  let depth = 0
  for (;;) {
    chain.push(current)
    if (isTerminal && isTerminal(current)) break
    if (!map.has(current)) break
    if (visited.has(current)) {
      throw new FallbackCycleError(chain)
    }
    visited.add(current)
    depth += 1
    if (depth > maxDepth) {
      throw new FallbackDepthError(chain, maxDepth)
    }
    current = map.get(current) as string
  }
  if (isTerminal && !isTerminal(current)) {
    throw new FallbackMissingTargetError(chain, current)
  }
  return { resolved: current, chain }
}
