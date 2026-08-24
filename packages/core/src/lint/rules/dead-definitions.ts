import { getFromTree, getTextContentFromNode, PodliteDocument } from '@podlite/schema'
import type { Rule, Violation, LintContext } from '../types'

export const DEAD_DEFINITIONS_RULE_ID = 'dead-definitions'

type Definition = { kind: 'alias' | 'data'; name: string; location?: Violation['location'] }

type AnyNode = {
  type?: string
  name?: string
  config?: Array<{ name?: string; value?: unknown }>
  content?: unknown
  location?: Violation['location']
}

const attr = (node: AnyNode, name: string): string | undefined => {
  const item = (Array.isArray(node.config) ? node.config : []).find(c => c && c.name === name)
  return item && item.value !== undefined && item.value !== null ? String(item.value) : undefined
}

// An alias node carries no location, so the line is read back from the source;
// a warning that cannot say where is a warning the author cannot act on.
const aliasLine = (source: string, name: string): Violation['location'] | undefined => {
  const lines = source.split(/\r?\n/)
  const at = lines.findIndex(line => new RegExp(`^\\s*=alias\\s+${name}(\\s|$)`).test(line))
  if (at === -1) return undefined
  return { start: { line: at + 1, column: 1, offset: 0 }, end: { line: at + 1, column: 1, offset: 0 } }
}

const definitions = (ast: PodliteDocument): Definition[] => {
  const nodes = getFromTree(ast, () => true) as AnyNode[]
  const found: Definition[] = []
  for (const node of nodes) {
    if (node.type === 'alias' && node.name) {
      found.push({ kind: 'alias', name: node.name, location: node.location })
      continue
    }
    if (node.name === 'data') {
      const key = attr(node, 'key')
      if (key) found.push({ kind: 'data', name: key, location: node.location })
    }
  }
  return found
}

const aliasUses = (ast: PodliteDocument): Set<string> => {
  const nodes = getFromTree(ast, () => true) as AnyNode[]
  const used = new Set<string>()
  for (const node of nodes) {
    if (node.type !== 'fcode' || node.name !== 'A') continue
    const name = getTextContentFromNode(node as never)
      ?.toString()
      .trim()
    if (name) used.add(name)
  }
  return used
}

// A data reference is read from the source rather than from the tree: the block
// that consumes it resolves the reference while the tree is built, so by the
// time a rule sees the tree the mention is already gone.
const dataUses = (source: string): Set<string> => {
  const used = new Set<string>()
  const reference = /data:([A-Za-z0-9_-]+)/g
  let match: RegExpExecArray | null
  while ((match = reference.exec(source)) !== null) used.add(match[1])
  return used
}

export const deadDefinitionsRule: Rule = {
  id: DEAD_DEFINITIONS_RULE_ID,
  severity: 'warning',
  check: (ast: PodliteDocument, ctx: LintContext): Violation[] => {
    // without the source a data reference cannot be found at all, and reporting
    // every keyed block as dead would be worse than saying nothing
    const declared = definitions(ast).filter(item => item.kind === 'alias' || ctx.source !== undefined)
    if (declared.length === 0) return []

    const aliases = aliasUses(ast)
    const keys = dataUses(ctx.source || '')

    return declared
      .filter(item => !(item.kind === 'alias' ? aliases.has(item.name) : keys.has(item.name)))
      .map(item => ({
        rule: DEAD_DEFINITIONS_RULE_ID,
        severity: 'warning' as const,
        message:
          item.kind === 'alias'
            ? `=alias ${item.name} is never used; A<${item.name}> appears nowhere in the document`
            : `=data :key<${item.name}> is never used; data:${item.name} appears nowhere in the document`,
        location: item.location || (item.kind === 'alias' ? aliasLine(ctx.source || '', item.name) : undefined),
      }))
  },
}
