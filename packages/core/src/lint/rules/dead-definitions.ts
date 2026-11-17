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

// the text of a block as written: verbatim lines, or the text of the paragraph a directive holds
const textOf = (node: AnyNode): string =>
  (Array.isArray(node.content) ? node.content : [])
    .map(c => (c && typeof c === 'object' ? (typeof c.value === 'string' ? c.value : textOf(c)) : ''))
    .join('')

const firstLine = (text: string): string => text.split('\n').find(line => line.trim() !== '') || ''

// the text of a code that may point somewhere: what follows a bar, or the opening of L, P or W
const codedTexts = (text: string): string[] => text.match(/(?:\||[LPW](?:<+|«))\s*data:[^\n]*/g) || []

// A key counts as used wherever a document may read it: a source, a table
// reference, a picture, a selector operand, a link. Prose, comments, code and
// other attributes never read it. The block that reads a reference replaces it
// while the tree is built, so the places of reading are found in the tree the
// parser writes before its plugins, and codes in the finished tree. What is
// gathered is the text at those places; a key is found in it whole, so a key
// with a space or a `#` in it is matched as the table reading it matches it.
const readingTexts = (ast: PodliteDocument, source: string, fileType: FileType): string[] => {
  const texts: string[] = []
  const add = (text: unknown) => typeof text === 'string' && texts.push(text)
  const isComment = (n: AnyNode) => n.type === 'block' && n.name === 'comment'
  // a Markdown document has no Podlite blocks to read before the plugins
  const raw =
    fileType === 'md' ? [] : podlitePluggable().parse(source, { podMode: fileType === 'default' ? 0 : 1, skipChain: 1 })
  const walkRaw = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walkRaw)
    if (!node || typeof node !== 'object') return
    const n = node as AnyNode
    if (isComment(n)) return
    for (const item of Array.isArray(n.config) ? n.config : [])
      if (item && (item.name === 'src' || item.name === 'link')) add(item.value)
    if (n.type === 'block' && n.name === 'table') {
      const ref = detectSourceReference(n)
      if (ref && ref.scheme === 'data') add(`data:${ref.target}`)
    }
    if (n.type === 'block' && n.name === 'picture') {
      const [head = '', ...caption] = textOf(n)
        .split('\n')
        .filter(line => line.trim() !== '')
      // the address may follow a description on the first line
      add(head.trim())
      codedTexts(caption.join('\n')).forEach(add)
    }
    // an alias spells its codes as text until it is called
    if (n.type === 'alias') codedTexts((Array.isArray(n.replacement) ? n.replacement : []).join('\n')).forEach(add)
    if (n.type === 'block' && n.name === 'markdown') markdownLinkTargets(textOf(n)).forEach(add)
    const selected = (selector: string) => dataKeysOfSelector(selector).forEach(key => add(`data:${key}`))
    if (n.type === 'block' && n.name === 'include') selected(splitDirective(firstLine(textOf(n)).trim()).selector)
    if (n.type === 'block' && n.name === 'toc') selected(firstLine(textOf(n)).trim())
    if (n.type === 'block' && n.name === 'assert') selected(textOf(n).trim())
    if (Array.isArray(n.content)) n.content.forEach(walkRaw)
  }
  walkRaw(raw)
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== 'object') return
    const n = node as AnyNode & { src?: unknown; caption?: unknown }
    if (isComment(n) || (n.type === 'fcode' && n.name === 'Z')) return
    if (n.type === 'fcode' && (n.name === 'L' || n.name === 'W')) add(linkTarget(n))
    if (n.type === 'image') add(n.src)
    if (Array.isArray(n.content)) n.content.forEach(walk)
    // a caption parsed from an attribute sits beside the content
    if (n.caption && typeof n.caption === 'object') walk(n.caption)
  }
  walk(ast)
  return texts
}

// `data:KEY` stands in the text, ending where an address or a code ends
const reads = (texts: string[], key: string): boolean => {
  const address = `data:${key}`
  return texts.some(text => {
    for (let at = text.indexOf(address); at >= 0; at = text.indexOf(address, at + 1)) {
      const next = text[at + address.length]
      if ((at === 0 || /[\s|<«(]/.test(text[at - 1])) && (next === undefined || /[\s#|>»)\]]/.test(next))) return true
    }
    return false
  })
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
    const texts = ctx.source === undefined ? [] : readingTexts(ast, ctx.source, ctx.fileType)
    let lines: Map<string, number> | undefined
    const aliasLine = (name: string): Violation['location'] | undefined => {
      lines = lines || aliasLines(ctx.source || '')
      const line = lines.get(name)
      return line === undefined
        ? undefined
        : { start: { line, column: 1, offset: 0 }, end: { line, column: 1, offset: 0 } }
    }

    return declared
      .filter(item => !(item.kind === 'alias' ? aliases.has(item.name) : reads(texts, item.name)))
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
