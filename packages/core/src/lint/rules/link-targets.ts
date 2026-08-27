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

// A link without display text carries the target in its content instead of meta.
const linkTarget = (node: LinkNode): string => {
  if (typeof node.meta === 'string') return node.meta.trim()
  const content = Array.isArray(node.content) ? node.content : []
  const first = content[0]
  return typeof first === 'string' ? first.trim() : ''
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
// A single letter before the colon is a Windows drive, not a scheme, and a
// document written on Windows would otherwise go unchecked.
const DRIVE = /^[a-zA-Z]:[\\/]/

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
