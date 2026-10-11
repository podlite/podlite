import { stripMarker } from './stripMarker'

// a single # as the whole first word asks for a numbered heading or item
const SHORTHAND = /^\s*#(?=\s|$)\s*/

const firstText = para => {
  if (typeof para?.text === 'string') return para.text
  const first = Array.isArray(para?.content) ? para.content[0] : undefined
  if (typeof first === 'string') return first
  return typeof first?.value === 'string' ? first.value : undefined
}

// The shorthand counts as an option written on the block: one written there
// decides, one given by =set gives way, and =config comes later and skips a
// name the block already has.
export const applyNumberedShorthand = node => {
  const para = node.content[0]
  const text = para && firstText(para)
  if (text === undefined || !SHORTHAND.test(text)) return
  const config = Array.isArray(node.config) ? node.config : []
  const written = config.find(c => c && c.name === 'numbered' && c.from === undefined)
  if (written && [false, 0, '0', 'false'].includes(written.value)) return
  stripMarker(para, SHORTHAND)
  if (written) return
  node.config = [
    ...config.filter(c => !(c && c.name === 'numbered')),
    { name: 'numbered', value: true, type: 'boolean' },
  ]
}
