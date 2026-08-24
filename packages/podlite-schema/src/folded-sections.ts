// Folding of a section belongs to the tree, not to one renderer: the command
// line and every build-time producer read the same document as the editor does.
// Moved here from @podlite/to-jsx, where it lived and left exportHtml and
// exportMarkdown unable to fold anything.
// `:folded` on a heading folds the whole section — the heading plus every
// following node up to the next same-or-higher-level heading. Detect the
// attribute on =head nodes in a container's content array and wrap that
// range in a synthetic `_folded_section` block so the JSX renderer can emit
// <details> around it.
const getFoldedAttr = (node: any): boolean | number | string | null => {
  const config = node && node.config
  if (!Array.isArray(config)) return null
  const entry = config.find((c: any) => c && c.name === 'folded')
  return entry ? entry.value : null
}

const isHeadBlock = (node: any): boolean =>
  node && node.type === 'block' && node.name === 'head' && node.level !== undefined && node.level !== null

const headLevel = (node: any): number => Number(node.level)

const groupFoldedSections = (content: any[]): any[] => {
  if (!Array.isArray(content)) return content
  const result: any[] = []
  let i = 0
  while (i < content.length) {
    const node = content[i]
    if (isHeadBlock(node)) {
      const folded = getFoldedAttr(node)
      if (folded !== null) {
        const level = headLevel(node)
        const sectionNodes: any[] = [node]
        let j = i + 1
        while (j < content.length) {
          const next = content[j]
          if (isHeadBlock(next) && headLevel(next) <= level) break
          sectionNodes.push(next)
          j++
        }
        result.push({
          type: 'block',
          name: '_folded_section',
          content: sectionNodes,
          foldedState: folded,
          location: node.location,
        })
        i = j
        continue
      }
    }
    result.push(node)
    i++
  }
  return result
}

// Walk the AST and apply `groupFoldedSections` to every block's `content`
// array, so :folded heads inside named blocks, defn, nested etc. fold the
// same way they do at the pod-level. Inside an already-built
// `_folded_section`, the first element is the heading the wrapper belongs
// to — skip it when grouping the rest, otherwise the same head would be
// re-wrapped on every recursion. Nested folds (a folded heading inside a
// folded section's body) are still picked up by grouping the remainder.
export const applyFoldedSections = (node: any): any => {
  if (!node || typeof node !== 'object') return node
  if (Array.isArray(node)) return node.map(applyFoldedSections)
  if (!Array.isArray(node.content)) return node
  if (node.name === '_folded_section') {
    const [head, ...rest] = node.content
    const grouped = groupFoldedSections(rest)
    return {
      ...node,
      content: [applyFoldedSections(head), ...grouped.map(applyFoldedSections)],
    }
  }
  const grouped = groupFoldedSections(node.content)
  return { ...node, content: grouped.map(applyFoldedSections) }
}
