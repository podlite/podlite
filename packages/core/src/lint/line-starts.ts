import type { Violation } from './types'

// where each line begins, counted the way the rules split lines: by \n, a \r before it stays on its line
export const lineStarts = (source: string): number[] => {
  const starts = [0]
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') starts.push(i + 1)
  return starts
}

// the start of a line, as the parser places a block: a mute compares these offsets
export const placeAtLine = (starts: number[], line: number): NonNullable<Violation['location']> => {
  const at = { line, column: 1, offset: starts[line - 1] ?? 0 }
  return { start: at, end: { ...at } }
}
