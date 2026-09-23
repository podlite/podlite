import {
  Plugin,
  getFromTree,
  getTextContentFromNode,
  mkTocItem,
  mkTocList,
  mkToc,
  TocList,
  Toc,
  getNodeId,
  Plugins,
  makeAttrs,
  isNamedBlock,
  mkFomattingCodeL,
  mkBlock,
  mkNode,
  markGuarded,
  mkCaption,
  parseFormattingCodes,
  parseSelector,
  runSelector,
  SelectorError,
} from '@podlite/schema'
import { prepareDataForToc } from './helpers'
import { PodNode } from '@podlite/schema'
type TocEntry = {
  text: string
  // the nodes the text is read from; null when it comes from an attribute value
  source: any[] | null
}

const bodyOf = (node: any): any[] =>
  Array.isArray(node.content)
    ? node.content.flatMap((child: any) => (child && child.type === 'para' ? child.content || [] : [child]))
    : []

// Where the text of an entry comes from, chosen once: the string and the nodes
// behind it must not be picked by two rules that can drift apart.
const entryOf = (node: PodNode): TocEntry => {
  if (typeof node !== 'string' && 'type' in node) {
    // a paragraph or code written without a marker is titled by its text
    if (node.type === 'para' || node.type === 'code') {
      const content = (node as any).content
      return { text: getTextContentFromNode(node), source: Array.isArray(content) ? content : null }
    }
    if (node.type === 'block') {
      const conf = makeAttrs(node, {})
      if (isNamedBlock(node.name)) {
        if (conf.exists('caption')) return { text: conf.getFirstValue('caption'), source: null }
        if (conf.exists('title')) return { text: conf.getFirstValue('title'), source: null }
        const [captionNode] = getFromTree(node, 'caption')
        if (captionNode)
          return { text: getTextContentFromNode(captionNode), source: (captionNode as any).content || null }
        return { text: `${node.name} not have :caption`, source: null }
      }
      if (node.name == 'image') {
        const caption = getTextContentFromNode(conf.getFirstValue('caption'))
        return { text: caption || 'image not have caption', source: null }
      }
      if (node.name == 'table') {
        const caption = getTextContentFromNode(conf.getFirstValue('caption'))
        return { text: caption || 'table not have :caption', source: null }
      }
      if (node.type === 'block' && node.name === 'item') {
        if (Array.isArray(node.content) && node.content.length > 0) {
          return { text: getTextContentFromNode(node.content[0]), source: [node.content[0]] }
        }
      }
      if (conf.exists('caption')) {
        const caption = getTextContentFromNode(conf.getFirstValue('caption'))
        if (caption) return { text: caption, source: null }
      } else if (conf.exists('title')) {
        const title = getTextContentFromNode(conf.getFirstValue('title'))
        if (title) return { text: title, source: null }
      } else {
        const [captionNode] = getFromTree(node, 'caption')
        if (captionNode) {
          const caption = getTextContentFromNode(captionNode)
          if (caption) return { text: caption, source: (captionNode as any).content || null }
        }
      }
      return { text: getTextContentFromNode(node), source: bodyOf(node) }
    }
  }
  return { text: 'Not supported toc element', source: null }
}

export const getContentForToc = (node: PodNode): string => entryOf(node).text
/* 


*/

// Codes that only change how text looks; anything else would make something of
// its own inside an entry: a link within the link, a second note, index entry or
// definition, an alias the renderer expands after this point.
const KEPT_CODES = new Set(['B', 'I', 'U', 'C', 'K', 'T', 'R', 'S', 'V', 'E', 'G'])

const isGuarded = (node: any): boolean =>
  Boolean(node && typeof node === 'object' && (node.guarded === true || (node.type === 'fcode' && node.name === 'G')))

const textNode = (value: string, guarded: boolean) =>
  guarded ? { type: 'text', value, guarded: true } : { type: 'text', value }

// The text of a code taken apart into its text nodes: joined, it reads as the
// entry's string does now, and each part keeps its own mark.
const textParts = (node: any, guarded: boolean): any[] => {
  if (typeof node === 'string') return [textNode(node, guarded)]
  if (!node || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(child => textParts(child, guarded))
  if (node.type === 'fcode' && node.name === 'N') return []
  const covered = guarded || isGuarded(node)
  if (node.type === 'text' || node.type === 'verbatim') return [textNode(String(node.value), covered)]
  return textParts(node.content, covered)
}

// A guard mark reaches nodes, not strings, so the text of a parsed value is made
// into text nodes before it is marked. V and E keep their content as written.
const textIntoNodes = (nodes: unknown[]): void => {
  nodes.forEach((child, i) => {
    if (typeof child === 'string') nodes[i] = textNode(child, false)
    else if (
      typeof child === 'object' &&
      child !== null &&
      'content' in child &&
      Array.isArray(child.content) &&
      !('name' in child && (child.name === 'V' || child.name === 'E'))
    )
      textIntoNodes(child.content)
  })
}

// parsed the way a picture's caption is, so every code in it keeps its meaning
const captionOf = (value: unknown, hidden: boolean) => {
  const content = parseFormattingCodes(String(value), {})
  textIntoNodes(content)
  return markGuarded(mkCaption(content), hidden)
}

const labelCopy = (node: any, guarded: boolean): any[] => {
  if (typeof node === 'string') return [textNode(node, guarded)]
  if (!node || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(child => labelCopy(child, guarded))
  const covered = guarded || isGuarded(node)
  if (node.type === 'fcode') {
    if (node.name === 'N') return []
    if (!KEPT_CODES.has(node.name)) return textParts(node, guarded)
    // the content of V is kept as written, and E holds nodes that name its character
    const content = node.name === 'V' || node.name === 'E' ? node.content : labelCopy(node.content, covered)
    return [{ ...node, content }]
  }
  if (node.type === 'text') return [{ ...node, ...(covered ? { guarded: true } : {}) }]
  if (node.type === 'verbatim') return [textNode(String(node.value), covered)]
  // a paragraph or a block cannot stand inside a link: its inline content does
  if (Array.isArray(node.content)) return labelCopy(node.content, covered)
  return []
}

const holdsGuarded = (node: any): boolean => {
  if (!node || typeof node !== 'object') return false
  if (Array.isArray(node)) return node.some(holdsGuarded)
  return isGuarded(node) || holdsGuarded(node.content)
}

// What the link of an entry holds: the string as before, unless something in its
// source is hidden, so the entry hides what the source hides and shows the rest.
const entryContent = (node: any, text: string, wholeHidden: boolean): any[] => {
  if (wholeHidden || isGuarded(node)) return [textNode(text, true)]
  const { source } = entryOf(node)
  if (!source || !holdsGuarded(source)) return [text]
  return markGuarded(labelCopy(source, false), false)
}
// Blocks whose text is not shown, and a directive, are not entries unless named
const UNSHOWN = new Set(['comment', 'data', 'include'])

const warn = (message: string): void => console.warn(`[toc] ${message}`)

// The selector is the first line of the block that holds more than whitespace;
// a markup code in it is not part of a selector, whether or not it was parsed.
const selectorOf = (node: PodNode): { selector: string; coded: boolean } => {
  let line = ''
  let coded = false
  // true once the line is complete
  const walk = (n: any): boolean => {
    if (typeof n === 'string' || (n && (n.type === 'text' || n.type === 'verbatim'))) {
      for (const ch of typeof n === 'string' ? n : String(n.value)) {
        if (ch !== '\n') {
          line += ch
          continue
        }
        if (line.trim() !== '') return true
        line = ''
        coded = false
      }
      return false
    }
    if (Array.isArray(n)) return n.some(walk)
    if (!n || typeof n !== 'object') return false
    if (n.type === 'fcode') {
      coded = true
      line += getTextContentFromNode(n)
      return false
    }
    return walk(n.content)
  }
  walk((node as any).content)
  const selector = line.trim()
  return { selector: selector || 'head', coded: coded || /(^|[^:\w])[A-Z](<|«)/.test(selector) }
}

// The blocks of the document the table stands in that its selector finds; a
// selector that cannot be read, names a source or needs a file finds nothing.
const entriesFor = (node: PodNode, fulltree: any, self: unknown): any[] => {
  const { selector, coded } = selectorOf(node)
  const parsed = coded ? undefined : parseSelector(selector)
  if (!parsed) {
    warn(`the selector cannot be read: ${selector}`)
    return []
  }
  if (parsed.scheme) {
    warn(`a table of contents lists the blocks of its own document: ${selector}`)
    return []
  }
  let found: any[]
  try {
    found = runSelector(selector, [{ file: '', node: fulltree }]) as any[]
  } catch (e) {
    if (!(e instanceof SelectorError)) throw e
    warn(
      e.kind === 'resolution'
        ? `a table of contents reads no file: ${e.message}`
        : `the selector cannot be read: ${e.message}`,
    )
    return []
  }
  const named = new Set(parsed.patterns.map(p => p.blockType))
  return found.filter(
    n => n !== node && n !== self && !(n.type === 'block' && UNSHOWN.has(n.name) && !named.has(n.name)),
  )
}

export const plugin: Plugin = {
  toAstAfter: (writer, processor, fulltree) => {
    // marks are set again after this pass; an entry needs them now, while it is built
    markGuarded(fulltree)
    return (node, ctx) => {
      // the directive keeps its place as a block and holds the table it made; a
      // table made once is not read again as a selector
      if (Array.isArray(node.content) && node.content.some(c => c && c.type === 'toc')) return node
      const tocHidden = isGuarded(node)
      // a table made again over an assembled document is told which node it is there
      const nodes = entriesFor(node, fulltree, ctx && ctx.tocSelf)
      const tocTree = prepareDataForToc(nodes)
      const createList = (items: any[], level): TocList => {
        const resultList = []
        items.map(item => {
          const { level, node, content } = item
          // create new node for each item
          const text = getContentForToc(node) || ' ' // ' ' needs to avoid lack of L<>
          //TODO: 1. getNodeId should use ctx of node, but using {} instead
          //TODO: 2. refactor linking for blocks
          const para = mkNode({
            type: 'para',
            content: [mkFomattingCodeL({ meta: `#${getNodeId(node, {})}` }, entryContent(node, text, tocHidden))],
          }) as PodNode
          const tocNode = para
          resultList.push(mkTocItem(tocNode))
          if (Array.isArray(content) && content.length > 0) {
            resultList.push(createList(content, level + 1))
          }
        })
        return mkTocList(resultList, level)
      }
      const conf = makeAttrs(node, ctx)
      const tocTitle = conf.getFirstValue('caption') || conf.getFirstValue('title')

      // Parse :folded (bare) — wraps entire TOC in <details>.
      //   :folded      -> folded: true  (collapsed)
      //   :!folded     -> folded: false (expanded disclosure)
      //   :folded(0)   -> folded: false
      let folded: boolean | undefined
      if (conf.exists('folded')) {
        const raw = conf.getFirstValue('folded')
        folded = !(raw === false || raw === 0 || raw === '0')
      }

      // Parse :folded-levels attribute. Supports both forms:
      //   :folded-levels(2,3)          -> {2: true, 3: true}     (every listed level folded)
      //   :folded-levels{2=>1, 3=>0}   -> {2: true, 3: false}    (per-level folding state)
      let foldedLevels: Record<number, boolean> | undefined
      if (conf.exists('folded-levels')) {
        const mapValue = conf.getMapValue('folded-levels')
        if (mapValue) {
          foldedLevels = {}
          for (const [k, v] of Object.entries(mapValue)) {
            const level = Number(k)
            if (!isNaN(level)) {
              foldedLevels[level] = Number(v) !== 0
            }
          }
        } else {
          const values = conf.getAllValues('folded-levels')
          if (Array.isArray(values) && values.length > 0) {
            foldedLevels = {}
            for (const v of values) {
              const level = Number(v)
              if (!isNaN(level)) {
                foldedLevels[level] = true
              }
            }
          }
        }
      }

      const hasTitle = tocTitle !== undefined && tocTitle !== null && String(tocTitle) !== ''
      // marked here: when a table is rebuilt after the includes, no marking pass follows
      const caption = hasTitle ? captionOf(tocTitle, tocHidden) : undefined

      const makeToc = (tocTree: any, title): Toc => {
        return mkToc(createList(tocTree.content, 1), title, node.location, foldedLevels, folded, caption)
      }

      const toc = makeToc(tocTree, tocTitle)
      return { ...node, content: [tocHidden ? { ...toc, guarded: true } : toc] }
    }
  },
}
export const PluginRegister: Plugins = {
  Toc: plugin, //TODO: deprecate it
  toc: plugin,
}
export default plugin
