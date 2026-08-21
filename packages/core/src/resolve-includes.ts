import * as fs from 'fs'
import * as path from 'path'
import {
  filePathMatches,
  getTextContentFromNode,
  parseSelector,
  runSelector,
  SelectorDoc,
  PodNode,
} from '@podlite/schema'

export type ResolveIncludesOptions = {
  baseDir: string
  parse: (source: string) => any
}

const isIncludeBlock = (node: any): boolean =>
  node && typeof node === 'object' && node.type === 'block' && node.name === 'include'

const hasMask = (target: string): boolean => /[*?]/.test(target)

// A mask that reaches into subdirectories is not expanded yet; it keeps the
// missing-target error rather than quietly resolving to nothing.
const reachesSubdirs = (target: string): boolean => target.includes('**')

// Everything up to the last separator that carries no mask; the rest is matched
// by the selector itself, which already knows the pattern language.
const fixedPrefix = (target: string): string => {
  const parts = target.split('/')
  const upto = parts.findIndex(hasMask)
  return parts.slice(0, upto === -1 ? parts.length : upto).join('/')
}

const listDir = (dir: string): string[] => {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter(e => e.isFile() && !e.name.startsWith('.'))
    .map(e => e.name)
    .sort()
}

// Candidate paths for a masked target, written the way the target is written so
// the selector matches them back. Matching runs before the file is read: the
// directory may hold anything, and a mask that does not name it must not send
// it through the parser.
const expandMask = (target: string, baseDir: string): string[] => {
  const prefix = fixedPrefix(target)
  return listDir(path.resolve(baseDir, prefix))
    .map(name => (prefix ? `${prefix}/${name}` : name))
    .filter(file => filePathMatches(file, target))
}

const keepBlocks = (items: Array<SelectorDoc | PodNode>): PodNode[] =>
  items.filter(item => item && typeof item === 'object' && !('file' in item)) as PodNode[]

const unwrapRoot = (blocks: PodNode[]): PodNode[] =>
  blocks.flatMap((b: any) =>
    b && b.type === 'block' && b.name === 'root' && Array.isArray(b.content) ? b.content : [b],
  )

export const resolveIncludes = (tree: any, opts: ResolveIncludesOptions): any => {
  const walkList = (list: any[], baseDir: string, stack: string[]): any[] =>
    list.flatMap(n => walkNode(n, baseDir, stack))

  const walkNode = (node: any, baseDir: string, stack: string[]): any => {
    if (!node || typeof node !== 'object') return node

    if (isIncludeBlock(node)) {
      const selector = getTextContentFromNode(node.content)?.toString().trim()
      const parsed = selector ? parseSelector(selector) : undefined
      if (!selector || !parsed || parsed.scheme !== 'file' || !parsed.document) return node

      const expands = hasMask(parsed.document) && !reachesSubdirs(parsed.document)
      const written = expands ? expandMask(parsed.document, baseDir) : [parsed.document]
      if (!expands && !fs.existsSync(path.resolve(baseDir, parsed.document))) {
        throw new Error(`include target not found: ${parsed.document}`)
      }

      const docs: Array<{ file: string; node: any }> = []
      for (const file of written) {
        const target = path.resolve(baseDir, file)
        if (stack.includes(target)) continue
        docs.push({
          file,
          node: walkNode(opts.parse(fs.readFileSync(target, 'utf-8')), path.dirname(target), [...stack, target]),
        })
      }
      if (docs.length === 0) return []

      return unwrapRoot(keepBlocks(runSelector(selector, docs)))
    }

    if (Array.isArray(node.content)) return { ...node, content: walkList(node.content, baseDir, stack) }
    return node
  }

  return walkNode(tree, opts.baseDir, [])
}
