import { Location } from '../types'

// A warning about a markup code is raised where the code is read, and that is
// text a block hands over: its lines without the indent they had, joined. The
// block knows where it stands in the source; the source shows each line whole,
// so a line of the text is found as the end of a line there, and the place in
// the text becomes a place in the source.
// the warnings of one piece of text share it, so its lines are matched to the source once
export interface PendingFragment {
  text: string
}
export interface PendingPlace {
  fragment: PendingFragment
  start: number
  end: number
}

export const lineStarts = (source: string): number[] => {
  const starts = [0]
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') starts.push(i + 1)
  return starts
}

interface Matched {
  // where each line of the text begins in the source, or undefined when it was not found
  found: number[]
  // where each line of the text begins in the text
  lines: number[]
}
const matched = new WeakMap<PendingFragment, Matched>()
// where the last piece of text found inside a line of a block ended: the cells of a
// row are read left to right, so a cell with the same text as one before it is the next
const cursors = new WeakMap<Location, number>()

const binary = (starts: number[], at: number): number => {
  let low = 0
  let high = starts.length - 1
  while (low < high) {
    const middle = (low + high + 1) >> 1
    if (starts[middle] <= at) low = middle
    else high = middle - 1
  }
  return low
}

// the line starts are counted once for a source and passed to every warning of it
export const placeInSource = (
  source: string,
  block: Location,
  pending: PendingPlace,
  starts: number[] = lineStarts(source),
): Location => {
  const lineOf = (k: number): string =>
    source.slice(starts[k], (starts[k + 1] ?? source.length + 1) - 1).replace(/\r$/, '')
  let match = matched.get(pending.fragment)
  if (!match) {
    const textLines = pending.fragment.text.split('\n')
    const found: number[] = []
    let k = Math.max(0, (block.start.line || 1) - 1)
    for (let j = 0; j < textLines.length && k < starts.length; j++) {
      const words = textLines[j].replace(/^\s+/, '')
      let hit = -1
      let inside = -1
      for (let s = k; s < starts.length; s++) {
        const line = lineOf(s)
        const at = words === '' ? line.length : line.lastIndexOf(words)
        const before = line.slice(0, at)
        if (at >= 0 && at + words.length === line.length && (j === 0 || /^\s*$/.test(before))) {
          hit = s
          break
        }
        // a single line of text may stand inside a line, as a table cell does
        if (j === 0 && textLines.length === 1 && words !== '') {
          const cursor = cursors.get(block) ?? -1
          const from = cursor >= starts[s] && cursor <= starts[s] + line.length ? cursor - starts[s] : 0
          if (cursor > starts[s] + line.length) continue
          const where = line.indexOf(words, from)
          if (where >= 0) {
            hit = s
            inside = where
            cursors.set(block, starts[s] + where + words.length)
            break
          }
        }
      }
      if (hit < 0) break
      const line = lineOf(hit)
      const wordsAt = inside >= 0 ? inside : line.length - words.length
      found.push(starts[hit] + wordsAt - (textLines[j].length - words.length))
      k = hit + 1
    }
    match = { found, lines: lineStarts(pending.fragment.text) }
    matched.set(pending.fragment, match)
  }
  const { found, lines } = match
  const point = (offset: number) => {
    const j = binary(lines, offset)
    const column = offset - lines[j]
    if (found[j] === undefined) return { ...block.start }
    const at = Math.max(starts[0], found[j] + column)
    const line = binary(starts, at)
    return { offset: at, line: line + 1, column: at - starts[line] + 1 }
  }
  return { start: point(pending.start), end: point(pending.end) }
}
