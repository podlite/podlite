import {
  dataKeysOfSelector,
  detectSourceReference,
  getFromTree,
  getTextContentFromNode,
  linkTarget,
  podlitePluggable,
  PodliteDocument,
} from '@podlite/schema'
import { markdownLinkTargets } from '@podlite/markdown'
import { splitDirective } from '../../assemble'
import type { FileType, Rule, Violation, LintContext } from '../types'

export const DEAD_DEFINITIONS_RULE_ID = 'dead-definitions'

type Definition = { kind: 'alias' | 'data'; name: string; location?: Violation['location'] }

type AnyNode = {
  type?: string
  name?: string
  replacement?: unknown
  config?: Array<{ name?: string; value?: unknown }>
  content?: unknown
  location?: Violation['location']
}

const attr = (node: AnyNode, name: string): string | undefined => {
  const item = (Array.isArray(node.config) ? node.config : []).find(c => c && c.name === name)
  return item && item.value !== undefined && item.value !== null ? String(item.value) : undefined
}

// An alias node carries no location, so the line is read back from the source;
// a warning that cannot say where is a warning the author cannot act on. The
// source is read once for all aliases, and the first line declaring a name wins.
const aliasLines = (source: string): Map<string, number> => {
  const lines = new Map<string, number>()
  source.split(/\r?\n/).forEach((line, at) => {
    const found = /^\s*=alias\s+(\S+)(\s|$)/.exec(line)
    if (found && !lines.has(found[1])) lines.set(found[1], at + 1)
  })
  return lines
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

// the key of a `data:` address, without the column after `#`
const keyOf = (address: unknown): string | undefined => {
  const found = typeof address === 'string' ? /^\s*data:([^\s#]+)/.exec(address) : null
  return found ? found[1] : undefined
}

// the text of a block as written: verbatim lines, or the text of the paragraph a directive holds
const textOf = (node: AnyNode): string =>
  (Array.isArray(node.content) ? node.content : [])
    .map(c => (c && typeof c === 'object' ? (typeof c.value === 'string' ? c.value : textOf(c)) : ''))
    .join('')

const keysBy = (pattern: RegExp, text: string): string[] => {
  const keys: string[] = []
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) keys.push(match[1])
  return keys
}

// the keys a link, a web link or a picture code written as text points at
const codedKeys = (text: string) => keysBy(/[LPW]<(?:[^<>|]*\|)?\s*data:([^\s>#|]+)/g, text)

// the keys a Markdown link or image points at, read by the Markdown parser
const markdownKeys = (text: string) => markdownLinkTargets(text).map(keyOf)

const firstLine = (text: string): string => text.split('\n').find(line => line.trim() !== '') || ''

// A key counts as used wherever a document may read it: a source, a table
// reference, a picture, a selector operand, a link. Prose, comments, code and
// other attributes never read it. The block that reads a reference replaces it
// while the tree is built, so the places of reading are found in the tree the
// parser writes before its plugins, and codes in the finished tree.
const dataUses = (ast: PodliteDocument, source: string, fileType: FileType): Set<string> => {
  const used = new Set<string>()
  const add = (key: string | undefined) => key && used.add(key)
  // a Markdown document has no Podlite blocks to read before the plugins
  const raw =
    fileType === 'md' ? [] : podlitePluggable().parse(source, { podMode: fileType === 'default' ? 0 : 1, skipChain: 1 })
  const walkRaw = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walkRaw)
    if (!node || typeof node !== 'object') return
    const n = node as AnyNode
    if (n.name === 'comment') return
    for (const item of Array.isArray(n.config) ? n.config : []) if (item && item.name === 'src') add(keyOf(item.value))
    if (n.type === 'block' && n.name === 'table') {
      const ref = detectSourceReference(n)
      if (ref && ref.scheme === 'data') add(keyOf(`data:${ref.target}`))
    }
    if (n.type === 'block' && n.name === 'picture') {
      const [head, ...caption] = textOf(n)
        .split('\n')
        .filter(line => line.trim() !== '')
      add(keyOf(head))
      codedKeys(caption.join('\n')).forEach(add)
    }
    // an alias spells its codes as text until it is called
    if (n.type === 'alias') codedKeys((Array.isArray(n.replacement) ? n.replacement : []).join('\n')).forEach(add)
    if (n.type === 'block' && n.name === 'markdown') markdownKeys(textOf(n)).forEach(add)
    if (n.type === 'block' && n.name === 'include')
      dataKeysOfSelector(splitDirective(firstLine(textOf(n)).trim()).selector).forEach(add)
    if (n.type === 'block' && n.name === 'toc') dataKeysOfSelector(firstLine(textOf(n)).trim()).forEach(add)
    if (n.type === 'block' && n.name === 'assert') dataKeysOfSelector(textOf(n).trim()).forEach(add)
    if (Array.isArray(n.content)) n.content.forEach(walkRaw)
  }
  walkRaw(raw)
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== 'object') return
    const n = node as AnyNode & { src?: unknown; meta?: unknown; caption?: unknown }
    if (n.name === 'comment' || (n.type === 'fcode' && n.name === 'Z')) return
    if (n.type === 'fcode' && (n.name === 'L' || n.name === 'W')) add(keyOf(linkTarget(n)))
    if (n.type === 'image') add(keyOf(n.src))
    if (Array.isArray(n.content)) n.content.forEach(walk)
    // a caption parsed from an attribute sits beside the content
    if (n.caption && typeof n.caption === 'object') walk(n.caption)
  }
  walk(ast)
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
    const keys = ctx.source === undefined ? new Set<string>() : dataUses(ast, ctx.source, ctx.fileType)
    let lines: Map<string, number> | undefined
    const aliasLine = (name: string): Violation['location'] | undefined => {
      lines = lines || aliasLines(ctx.source || '')
      const line = lines.get(name)
      return line === undefined
        ? undefined
        : { start: { line, column: 1, offset: 0 }, end: { line, column: 1, offset: 0 } }
    }

    return declared
      .filter(item => !(item.kind === 'alias' ? aliases.has(item.name) : keys.has(item.name)))
      .map(item => ({
        rule: DEAD_DEFINITIONS_RULE_ID,
        severity: 'warning' as const,
        message:
          item.kind === 'alias'
            ? `=alias ${item.name} is never used; A<${item.name}> appears nowhere in the document`
            : `=data :key<${item.name}> is never used`,
        location: item.location || (item.kind === 'alias' ? aliasLine(item.name) : undefined),
      }))
  },
}
