// A table of contents cut out of HTML: from its wrapper to the div that closes it,
// counted by depth, so a caption inside the wrapper does not end the cut early.
export const tocsOf = (html: string): string[] => {
  const opener = '<div class="toc">'
  const found: string[] = []
  let start = html.indexOf(opener)
  while (start !== -1) {
    const tags = /<div[\s>]|<\/div>/g
    tags.lastIndex = start
    let depth = 0
    let end = -1
    for (let tag = tags.exec(html); tag; tag = tags.exec(html)) {
      depth += tag[0] === '</div>' ? -1 : 1
      if (depth === 0) {
        end = tag.index + tag[0].length
        break
      }
    }
    if (end === -1) throw new Error('a table of contents in the output is not closed')
    found.push(html.slice(start, end))
    start = html.indexOf(opener, end)
  }
  return found
}

// fails when there is none, so a check on the cut cannot pass on an empty string
export const tocOf = (html: string): string => {
  const [first] = tocsOf(html)
  if (first === undefined) throw new Error('no table of contents in the output')
  return first
}
