import { getFromTree, PodliteDocument } from '@podlite/schema'
import type { Rule, Violation, LintContext } from '../types'

export const TOC_TITLE_ATTRIBUTE_RULE_ID = 'toc-title-attribute'

type ConfigEntry = { name?: string; from?: string }
type TocNode = { type?: string; name?: string; config?: ConfigEntry[]; location?: Violation['location'] }

// Toc is the older spelling the module of the table of contents still reads
const isToc = (node: unknown): node is TocNode =>
  typeof node === 'object' &&
  node !== null &&
  (node as TocNode).type === 'block' &&
  ((node as TocNode).name === 'toc' || (node as TocNode).name === 'Toc')

// The specification captions a table of contents with :caption, and the module of the
// table of contents no longer takes a caption from :title. The parser
// already puts on a block what =set and =config give it, marked by where it came
// from, so one reading of the block covers all three sources and gives one warning.
// The linter can assemble a document by its includes, and this rule does not: a
// warning about a block of another file would have to stand at the line of =include. So a
// :title that reaches a table of contents only when the files are assembled is not
// reported, as with the notification attribute.
export const tocTitleAttributeRule: Rule = {
  id: TOC_TITLE_ATTRIBUTE_RULE_ID,
  severity: 'warning',
  check: (ast: PodliteDocument, _ctx: LintContext): Violation[] =>
    getFromTree(ast, () => true).flatMap(node => {
      if (!isToc(node)) return []
      const entry = (node.config || []).find(c => c.name === 'title')
      if (!entry) return []
      const source = entry.from === 'set' || entry.from === 'config' ? ` given by =${entry.from}` : ''
      return [
        {
          rule: TOC_TITLE_ATTRIBUTE_RULE_ID,
          severity: 'warning' as const,
          message: `:title${source} on =${node.name} gives no caption; a caption is written :caption`,
          location: node.location,
        },
      ]
    }),
}
