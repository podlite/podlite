import makeAttrs from './helpers/config'

// Covered content is marked on the node, not decided at render time. A block
// carrying :masked or a G<> code can be lifted out of its document by =include,
// by a data: reference, by an alias expansion or by a selector; the mark travels
// with the node, so whatever pulls the node out cannot strip the cover off it.
const GUARD_CODE = 'G'

const isGuardCode = (node: { type?: string; name?: string }): boolean =>
  node.type === 'fcode' && node.name === GUARD_CODE

const isMaskedBlock = (node: { type?: string }): boolean => {
  if (node.type !== 'block') return false
  const conf = makeAttrs(node as never, {})
  return conf.exists('masked') && Boolean(conf.getFirstValue('masked'))
}

// The mark says the content is covered; the render mode says whether the cover
// is applied. Draft shows what production hides, and the mark alone must not
// override that.
export const isCovered = (node: unknown, ctx?: { maskMode?: boolean; renderMode?: string }): boolean => {
  if (ctx?.maskMode) return true
  if (ctx?.renderMode === 'draft') return false
  return Boolean((node as { guarded?: boolean })?.guarded)
}

export const markGuarded = <T>(node: T, inherited = false): T => {
  if (!node || typeof node !== 'object') return node
  if (Array.isArray(node)) {
    node.forEach(child => markGuarded(child, inherited))
    return node
  }
  const target = node as { content?: unknown; guarded?: boolean; type?: string; name?: string }
  const covered = inherited || target.guarded === true || isGuardCode(target) || isMaskedBlock(target)
  if (covered) target.guarded = true
  if (Array.isArray(target.content)) target.content.forEach(child => markGuarded(child, covered))
  return node
}
