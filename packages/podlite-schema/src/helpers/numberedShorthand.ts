import { stripMarker } from './stripMarker'

// a single # as the whole first word asks for a numbered heading or item
const SHORTHAND = /^\s*#(?=\s|$)\s*/

const firstText = para => {
  if (typeof para?.text === 'string') return para.text
  const first = Array.isArray(para?.content) ? para.content[0] : undefined
  if (typeof first === 'string') return first
  return typeof first?.value === 'string' ? first.value : undefined
}

const BEFORE_TEXT = ['blankline', 'config', 'alias', 'set']

/*
=begin pod :kind<export>

=head2 isBeforeText

Whether a node of a block's content can stand before the text of the block
without being its text: a blank line, or a C<=config>, C<=alias> or C<=set>
directive. The first node of the content that is not one of these is where the
text of an item, a heading or a definition starts — where a leading C<#> or a
check box is read and where a table of contents takes the entry of an item.

=end pod
*/
export const isBeforeText = (child: unknown): boolean => {
  const type: unknown = typeof child === 'object' && child !== null ? Reflect.get(child, 'type') : undefined
  return typeof type === 'string' && BEFORE_TEXT.includes(type)
}

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
