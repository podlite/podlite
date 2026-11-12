import { stripMarker } from './stripMarker'

// a single # as the whole first word asks for a numbered heading or item
const SHORTHAND = /^\s*#(?=\s|$)\s*/

const firstText = para => {
  if (typeof para?.text === 'string') return para.text
  const first = Array.isArray(para?.content) ? para.content[0] : undefined
  if (typeof first === 'string') return first
  return typeof first?.value === 'string' ? first.value : undefined
}

// what can stand before the text of a block without being its text
const BEFORE_TEXT = ['blankline', 'config', 'alias', 'set']

export const isBeforeText = (child): boolean => BEFORE_TEXT.includes(child?.type)

// The shorthand counts as an option written on the block: one written there
// decides, one given by =set gives way, and =config comes later and skips a
// name the block already has. Only the first paragraph of text can carry it;
// indented code in its place keeps its #.
export const applyNumberedShorthand = (
  node,
  para = (Array.isArray(node.content) ? node.content : []).find(child => !isBeforeText(child)),
) => {
  if (para?.type !== 'para') return
  const text = firstText(para)
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
