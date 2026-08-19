import { VERBATIM_BLOCKS } from '@podlite/schema'
import type { Violation, SourceRule } from '../types'

export const TABLE_COLUMN_WIDTH_RULE_ID = 'table-column-width'

export const tableColumnWidthRule: SourceRule = {
  id: TABLE_COLUMN_WIDTH_RULE_ID,
  severity: 'warning',
}

const SEPARATOR_LINE = /^[\s=+|_-]*[|+][\s=+|_-]*$/
const hasBar = (line: string) => line.includes('|') || line.includes('+')

// A table with visible bars is cut by the column positions its separator line
// sets, not by the bars in the row itself. A cell that reaches the boundary
// pushes the column open for the whole table, so every row loses its last
// column at once — and the document still parses, silently.
const boundaries = (separator: string): number[] => {
  const out: number[] = []
  for (let i = 0; i < separator.length; i++) {
    if (separator[i] === '|' || separator[i] === '+') out.push(i)
  }
  return out
}

const isEdge = (char: string) => char === '|' || char === '+' || char === ' '

const collides = (line: string, boundary: number): boolean => {
  if (boundary >= line.length) return false
  // content standing on the boundary, or pressed against it with no space left
  if (!isEdge(line[boundary])) return true
  return boundary > 0 && !isEdge(line[boundary - 1])
}

type TableLine = { text: string; line: number }

const checkTable = (lines: TableLine[]): Violation[] => {
  const separator = lines.find(l => SEPARATOR_LINE.test(l.text) && hasBar(l.text))
  if (!separator) return []
  const columns = boundaries(separator.text)
  if (columns.length === 0) return []

  const violations: Violation[] = []
  for (const row of lines) {
    if (row === separator || row.text.trim() === '') continue
    if (SEPARATOR_LINE.test(row.text)) continue
    const hit = columns.find(b => collides(row.text, b))
    if (hit === undefined) continue
    violations.push({
      rule: TABLE_COLUMN_WIDTH_RULE_ID,
      severity: 'warning',
      message: `cell reaches the column boundary at column ${
        hit + 1
      }; leave a space before the bar or the table loses a column`,
      location: {
        start: { line: row.line, column: hit + 1, offset: 0 },
        end: { line: row.line, column: hit + 1, offset: 0 },
      },
    })
  }
  return violations
}

export function scanTableColumns(content: string): Violation[] {
  const lines = content.split(/\r?\n/)
  // a table keeps its content verbatim too, and it is the one being read here
  const verbatim = new Set<string>(VERBATIM_BLOCKS.filter(name => name !== 'table'))
  const openBlocks: string[] = []
  const violations: Violation[] = []
  let table: TableLine[] | null = null

  const closeTable = () => {
    if (table) violations.push(...checkTable(table))
    table = null
  }

  for (let i = 0; i < lines.length; i++) {
    const text = lines[i]
    const begin = text.match(/^\s*=begin\s+([\w-]+)/)
    const end = text.match(/^\s*=end\s+([\w-]+)/)
    const abbreviated = text.match(/^\s*=(?:for\s+)?table\b/)

    if (end) {
      if (end[1] === 'table') closeTable()
      openBlocks.pop()
      continue
    }
    if (begin) {
      closeTable()
      openBlocks.push(begin[1])
      if (begin[1] === 'table' && !openBlocks.some(b => verbatim.has(b))) table = []
      continue
    }
    if (openBlocks.some(b => verbatim.has(b))) continue
    if (abbreviated) {
      closeTable()
      table = []
      continue
    }
    // an abbreviated table ends at the first blank line
    if (table && text.trim() === '' && !openBlocks.includes('table')) {
      closeTable()
      continue
    }
    if (table) table.push({ text, line: i + 1 })
  }
  closeTable()
  return violations
}
