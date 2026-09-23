import { getTextContentFromNode, toMarkdown } from '@podlite/schema'

/*
=begin pod :kind<module>

=head1 What a query gives of the blocks it found

The rules C<podlite query> and the MCP query share for the tree C<convert> reads:
which blocks the transformation adds around what was written, which blocks were
read out of a Markdown section, and how a found block is given as text and as
json.

=end pod
*/

/*
=begin pod :kind<export>

=head2 contentOf

What a document holds: a selection runs over it, not over the root.

=end pod
*/
export const contentOf = (tree: any): any =>
  tree && tree.type === 'block' && tree.name === 'root' && Array.isArray(tree.content) ? tree.content : tree

// blocks the transformation puts around what the author wrote
const WRAPPERS = new Set(['root', '_folded_section'])

/*
=begin pod :kind<export>

=head2 isWrapper

Whether a block is one the tree adds around what was written: the root inside a
Markdown section and a folded section. A query leaves such blocks out of what it
found.

=end pod
*/
export const isWrapper = (node: unknown): boolean => {
  const block = node as { type?: string; name?: string } | null
  return !!block && block.type === 'block' && WRAPPERS.has(String(block.name))
}

/*
=begin pod :kind<export>

=head2 markSections

Records, for each block read out of a Markdown section, the section it stands
in. Its place counts from the section, not from the file.

=end pod
*/
export const markSections = (tree: unknown, sections: WeakMap<object, any>, section?: any): void => {
  if (Array.isArray(tree)) return tree.forEach(n => markSections(n, sections, section))
  if (!tree || typeof tree !== 'object') return
  const node = tree as { type?: string; name?: string; content?: unknown }
  if (section) sections.set(node, section)
  const own = node.type === 'block' && (node.name === 'markdown' || node.name === 'Markdown') ? node : section
  markSections(node.content, sections, own)
}

const hasPlace = (block: any): boolean =>
  typeof block?.location?.start?.offset === 'number' && typeof block?.location?.end?.offset === 'number'

const sliceBlock = (text: string, block: any): string =>
  hasPlace(block) ? text.slice(block.location.start.offset, block.location.end.offset) : ''

// the rule markdown writes a table cell by: a bar inside the value is escaped
// and the lines of a value are joined
const cellText = (cell: any): string =>
  getTextContentFromNode(cell)
    .replace(/\s*\n\s*/g, ' ')
    .trim()
    .replace(/\|/g, '\\|')

/*
=begin pod :kind<export>

=head2 podliteText

The text of a block as its file holds it. A block with no place of its own in the
file, read out of a Markdown section or made by a plugin, is given as its
Markdown, hidden content shown; a row of such a table as one line of cells and a
cell as its text, which read back become a paragraph.

=end pod
*/
export const podliteText = (block: any, text: string, sections: WeakMap<object, any>): string => {
  if (hasPlace(block) && !sections.has(block)) return sliceBlock(text, block)
  if (block?.type === 'block' && block.name === 'row') {
    const cells = (Array.isArray(block.content) ? block.content : []).filter((c: any) => c && c.name === 'cell')
    return `| ${cells.map(cellText).join(' | ')} |`
  }
  if (block?.type === 'block' && block.name === 'cell') return cellText(block)
  const root: any = { type: 'block', name: 'pod', margin: '', content: [block] }
  return toMarkdown({ renderMode: 'draft' }).run(root).toString()
}

/*
=begin pod :kind<export>

=head2 jsonBlock

A block as the json output gives it. A block read out of a Markdown section is
given the place of the section, marked C<precision: section>, as the report of
C<podlite test> gives it. The ids the parser gives blocks are left out: the json
of one document is the same from run to run.

=end pod
*/
export const jsonBlock = (block: any, sections: WeakMap<object, any>): Record<string, unknown> => {
  const section = sections.get(block)
  const own = withoutParserIds(block)
  return section ? { ...own, location: section.location, precision: 'section' } : own
}

// The parser and the Markdown reader give nodes an id of their own, random for
// most of them; an address the author wrote lives in the configuration. Left in,
// the json of one document would differ from run to run.
const withoutParserIds = (node: any): any => {
  if (Array.isArray(node)) return node.map(withoutParserIds)
  if (!node || typeof node !== 'object') return node
  const copy: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(node)) {
    if (key === 'id' && typeof node.type === 'string') continue
    copy[key] = key === 'config' ? value : withoutParserIds(value)
  }
  return copy
}
