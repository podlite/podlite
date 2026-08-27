import type { Violation } from '../types'

type LinkNode = {
  name?: string
  meta?: string | null
  content?: unknown
  location?: Violation['location']
}

export type LinkSite = {
  target: string
  at?: Violation['location']
}

// Content is a bare string before the tree is processed and a node after it.
const textOf = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'value' in value && typeof value.value === 'string') return value.value
  return ''
}

// A link without display text carries the target in its content instead of meta.
const linkTarget = (node: LinkNode): string => {
  if (typeof node.meta === 'string') return node.meta.trim()
  const content = Array.isArray(node.content) ? node.content : []
  return textOf(content[0]).trim()
}

const isLink = (node: LinkNode & { type?: string }): boolean =>
  node.type === 'fcode' && (node.name === 'L' || node.name === 'W')

// Inline nodes carry no location, so the nearest enclosing block supplies one.
export const collectLinks = (node: unknown, at?: Violation['location']): LinkSite[] => {
  if (Array.isArray(node)) return node.flatMap(child => collectLinks(child, at))
  if (!node || typeof node !== 'object') return []
  const n = node as LinkNode & { type?: string }
  const here = n.location || at
  const found = isLink(n) ? [{ target: linkTarget(n), at: here }] : []
  return [...found, ...collectLinks(n.content, here)]
}

const SCHEME = /^([a-zA-Z][a-zA-Z0-9+.-]*):(.*)$/
// A single letter before the colon is a Windows drive, but only where something
// else says Windows: a separator, or a backslash further along. Without one,
// `a:b` is a scheme and reading it as a path would warn about a target that is
// not on this disk at all.
const DRIVE = /^[a-zA-Z]:([\\/]|[^\\]*\\)/

export type LinkAddress = {
  scheme: string | null
  // the address with its scheme, query and fragment removed
  path: string
}

// The specification separates the internal address from the external one with a
// `#`, so what is left of it is the part a filesystem can answer for.
export const readAddress = (target: string): LinkAddress => {
  const matched = DRIVE.test(target) ? null : SCHEME.exec(target)
  const scheme = matched ? matched[1].toLowerCase() : null
  const rest = matched ? matched[2] : target
  return { scheme, path: rest.split('#')[0].split('?')[0] }
}
