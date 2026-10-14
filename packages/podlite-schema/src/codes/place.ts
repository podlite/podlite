import { Location } from '../types'

// A warning about a markup code is raised where the code is read, and that is
// text a block hands over: its lines without the indent they had, joined. The
// block knows where it stands in the source; the source shows each line whole,
// so a line of the text is found as the end of a line there, and the place in
// the text becomes a place in the source.
export interface PendingPlace {
  text: string
  start: number
  end: number
}

const lineStarts = (source: string): number[] => {
  const starts = [0]
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') starts.push(i + 1)
  return starts
}

export const placeInSource = (source: string, block: Location, pending: PendingPlace): Location => {
  const starts = lineStarts(source)
  const lineOf = (k: number): string => source.slice(starts[k], (starts[k + 1] ?? source.length + 1) - 1).replace(/\r$/, '')
  const textLines = pending.text.split('\n')
  // where each line of the text begins in the source, found in order from the block's first line
  const found: number[] = []
  let k = Math.max(0, (block.start.line || 1) - 1)
  for (let j = 0; j < textLines.length && k < starts.length; j++) {
    const words = textLines[j].replace(/^\s+/, '')
    let hit = -1
    for (let s = k; s < starts.length; s++) {
      const line = lineOf(s)
      const at = words === '' ? line.length : line.lastIndexOf(words)
      const before = line.slice(0, at)
      if (at >= 0 && at + words.length === line.length && (j === 0 || /^\s*$/.test(before))) {
        hit = s
        break
      }
    }
    if (hit < 0) break
    const line = lineOf(hit)
    found.push(starts[hit] + line.length - words.length - (textLines[j].length - words.length))
    k = hit + 1
  }
  const point = (offset: number) => {
    const before = pending.text.slice(0, offset)
    const j = before.split('\n').length - 1
    const column = offset - (before.lastIndexOf('\n') + 1)
    if (found[j] === undefined) return { ...block.start }
    const at = Math.max(starts[0], found[j] + column)
    let line = 0
    while (line + 1 < starts.length && starts[line + 1] <= at) line++
    return { offset: at, line: line + 1, column: at - starts[line] + 1 }
  }
  return { start: point(pending.start), end: point(pending.end) }
}
