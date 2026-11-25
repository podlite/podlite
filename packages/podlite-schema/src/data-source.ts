/*
=begin pod :kind<module>

=head1 data-source

Pictures whose source is a C<data:> reference to a C<=data> block of the same
document. The address written stays in C<src>; the address a reader loads is
computed beside it.

=end pod
*/
import makeAttrs from './helpers/config'
import { extractDataText } from './plugin-tables'
import { isCovered } from './guard'

// the MIME types the norm lists for file extensions
const extensionTypes: Record<string, string> = {
  txt: 'text/plain',
  md: 'text/markdown',
  markdown: 'text/markdown',
  podlite: 'text/podlite',
  pod6: 'text/podlite',
  json: 'application/json',
  xml: 'application/xml',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  pdf: 'application/pdf',
  zip: 'application/zip',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  doc: 'application/msword',
  docx: 'application/msword',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  tab: 'text/tab-separated-values',
}

// characters that cannot open a fragment or the body of the address
const MIME_TYPE = /^[a-z0-9][a-z0-9._+-]*\/[a-z0-9][a-z0-9._+-]*$/
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/
const BASE64_DIGITS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

const isTextType = (type: string): boolean =>
  type.startsWith('text/') || type.endsWith('+xml') || type.endsWith('+json')

// TextEncoder is missing in some hosts (jsdom); a lone surrogate becomes U+FFFD as there
const utf8 = (text: string): number[] => {
  const bytes: number[] = []
  for (const char of text) {
    let c = char.codePointAt(0) ?? 0xfffd
    if (c >= 0xd800 && c <= 0xdfff) c = 0xfffd
    if (c < 0x80) bytes.push(c)
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63))
    else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
    else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
  }
  return bytes
}

const utf8Base64 = (text: string): string => {
  const bytes = utf8(text)
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out += BASE64_DIGITS[(n >> 18) & 63] + BASE64_DIGITS[(n >> 12) & 63]
    out += i + 1 < bytes.length ? BASE64_DIGITS[(n >> 6) & 63] : '='
    out += i + 2 < bytes.length ? BASE64_DIGITS[n & 63] : '='
  }
  return out
}

/*
=begin pod :kind<export>

=head2 isDataAddress

Whether a picture source is written with the C<data:> scheme, in lower case as
tables and the linter read it.

=end pod
*/
export const isDataAddress = (src: unknown): boolean => typeof src === 'string' && src.startsWith('data:')

/*
=begin pod :kind<export>

=head2 dataKeyOf

The key of a C<data:Key> reference, or C<null>. A ready data URL holds a comma
and is not a key; an address with C<#> names a column, which a picture does not
take; an empty key is no key.

=end pod
*/
export const dataKeyOf = (src: unknown): string | null => {
  if (typeof src !== 'string' || !isDataAddress(src)) return null
  const key = src.slice('data:'.length)
  if (key === '' || key.includes(',') || key.includes('#')) return null
  return key
}

const mimeTypeOf = (block): string | null => {
  const attrs = makeAttrs(block, {})
  // an explicit type replaces the one a file name would give
  if (attrs.exists('mime-type')) {
    const type = String(attrs.getFirstValue('mime-type') ?? '')
      .split(';')[0]
      .trim()
      .toLowerCase()
    return MIME_TYPE.test(type) ? type : null
  }
  const filename = attrs.getFirstValue('filename')
  const ext = typeof filename === 'string' ? filename.match(/\.([^./]+)$/) : null
  return ext ? extensionTypes[ext[1].toLowerCase()] ?? null : null
}

const bodyOf = (block, type: string): string | null => {
  const attrs = makeAttrs(block, {})
  const text = extractDataText(block)
  if (attrs.exists('encoding')) {
    if (String(attrs.getFirstValue('encoding')).toLowerCase() !== 'base64') return null
    const digits = text.replace(/\s+/g, '')
    return digits.length % 4 === 0 && BASE64.test(digits) ? digits : null
  }
  // binary content is written in base64, so only text is encoded here
  return isTextType(type) ? utf8Base64(text) : null
}

/*
=begin pod :kind<export>

=head2 resolveDataSource

The data URL of the C<=data> block with the given key: the first such block in
the tree. C<covered> is the mark the block carries once C<markGuarded> has run.
Returns C<null> when there is no block, no MIME type of the form C<type/subtype>,
or a body that cannot be given as base64.

=end pod
*/
export const resolveDataSource = (tree: unknown, key: string): { url: string; covered: boolean } | null =>
  sourceOf(indexDataBlocks(tree).get(key))

const sourceOf = (block): { url: string; covered: boolean } | null => {
  if (!block) return null
  const type = mimeTypeOf(block)
  if (!type) return null
  const body = bodyOf(block, type)
  if (body === null) return null
  return { url: `data:${type};base64,${body}`, covered: block.guarded === true }
}

type Walk = { visited: number }

const children = (node): unknown[] => {
  const found: unknown[] = []
  if (Array.isArray(node.content)) found.push(...node.content)
  else if (node.content && typeof node.content === 'object') found.push(node.content)
  // a caption parsed from an attribute value sits beside the content, not in it
  if (node.caption && typeof node.caption === 'object') found.push(node.caption)
  return found
}

const walkTree = (tree: unknown, visit: (node: any) => void, stats?: Walk) => {
  const stack: unknown[] = [tree]
  while (stack.length) {
    const node = stack.pop()
    if (Array.isArray(node)) {
      for (let i = node.length - 1; i >= 0; i--) stack.push(node[i])
      continue
    }
    if (!node || typeof node !== 'object') continue
    if (stats) stats.visited++
    visit(node)
    const next = children(node)
    for (let i = next.length - 1; i >= 0; i--) stack.push(next[i])
  }
}

const indexDataBlocks = (tree: unknown, stats?: Walk): Map<string, any> => {
  const blocks = new Map<string, any>()
  walkTree(
    tree,
    node => {
      if (node.type !== 'block' || node.name !== 'data') return
      const key = makeAttrs(node, {}).getFirstValue('key')
      if (typeof key === 'string' && !blocks.has(key)) blocks.set(key, node)
    },
    stats,
  )
  return blocks
}

/*
=begin pod :kind<export>

=head2 resolveDataImages

Gives each picture whose C<src> is a C<data:Key> reference the data URL of its
block in C<dataUrl>, and C<dataGuarded> when that block is covered. Both fields
are removed from every picture first, so a second walk computes them again.
C<src> and C<guarded> are not changed. Expects the marks of C<markGuarded>.

=end pod
*/
export const resolveDataImages = <T>(tree: T, stats?: Walk): T => {
  const blocks = indexDataBlocks(tree, stats)
  walkTree(
    tree,
    node => {
      if (node.type !== 'image') return
      delete node.dataUrl
      delete node.dataGuarded
      const key = dataKeyOf(node.src)
      const source = key === null ? null : sourceOf(blocks.get(key))
      if (!source) return
      node.dataUrl = source.url
      if (source.covered) node.dataGuarded = true
    },
    stats,
  )
  return tree
}

/*
=begin pod :kind<export>

=head2 imageAddress

The address a renderer writes for a picture. A picture hidden by its own mark,
or by the C<=data> block its bytes come from, gives C<src> as written outside
draft mode; C<asWritten> in the context always gives C<src>; otherwise the
computed C<dataUrl> when there is one.

=end pod
*/
export const imageAddress = <S>(
  node: { src?: S; dataUrl?: string; dataGuarded?: boolean; guarded?: boolean },
  ctx?: { maskMode?: boolean; renderMode?: string; asWritten?: boolean },
): S | string | undefined => {
  if (ctx?.asWritten || typeof node.dataUrl !== 'string') return node.src
  if (isCovered(node, ctx)) return node.src
  if (node.dataGuarded && (ctx?.maskMode || ctx?.renderMode !== 'draft')) return node.src
  return node.dataUrl
}
