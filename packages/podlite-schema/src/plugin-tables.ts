/**
 * Plugin for fill term's for defn. From S26:
 * The first non-blank line of content is treated as a term being defined,
 * and the remaining content is treated as the definition for the term.
 */
import makeTransformer from './helpers/makeTransformer'
import makeAttrs from './helpers/config'
function flattenDeep(arr) {
  return arr.reduce((acc, val) => (Array.isArray(val) ? acc.concat(flattenDeep(val)) : acc.concat(val)), [])
}

// ─── CSV source for =table (spec §1672) ────────────────────────────────────
// Parse CSV content per RFC 4180: comma delimiter, `"`-quoted fields with
// `""` as embedded-quote escape. Supports LF or CRLF line endings. Leading
// indentation typical of =data block bodies is stripped from each line.
function parseCsv(text) {
  const rows = []
  let field = ''
  let row = []
  let inQuote = false
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (inQuote) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i += 2
        continue
      }
      if (c === '"') {
        inQuote = false
        i++
        continue
      }
      field += c
      i++
      continue
    }
    if (c === '"' && field === '') {
      inQuote = true
      i++
      continue
    }
    if (c === ',') {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (c === '\r') {
      i++
      continue
    }
    if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
      continue
    }
    field += c
    i++
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  // Drop rows that are entirely blank (empty content after trim).
  return rows.filter(r => !(r.length === 1 && r[0].trim() === ''))
}

// Parse a TSV (tab-separated values) blob. Unlike CSV, TSV has no quoting
// mechanism — fields are split strictly on tabs and `"` is a literal
// character. Tabs and newlines inside fields are not representable in TSV.
function parseTsv(text) {
  const lines = text.split(/\r?\n/)
  const rows = lines.map(line => line.split('\t'))
  return rows.filter(r => !(r.length === 1 && r[0].trim() === ''))
}

// Parse a MIME type value into the bare type and a map of parameters
// (RFC 6838 / RFC 7231 §3.1.1.1). Used to recognise the `header` parameter
// (RFC 4180 §3) on `:mime-type` of CSV/TSV =data blocks.
//
// Examples:
//   "text/csv"                          → { type: 'text/csv', params: {} }
//   "text/csv; header=present"          → { type: 'text/csv', params: { header: 'present' } }
//   "text/csv;charset=utf-8;header=absent" → { ..., params: { charset: 'utf-8', header: 'absent' } }
function parseMimeType(raw): { type: string; params: Record<string, string> } {
  if (!raw || typeof raw !== 'string') return { type: '', params: {} }
  const parts = raw.split(';').map(s => s.trim())
  const type = (parts.shift() || '').toLowerCase()
  const params: Record<string, string> = {}
  for (const p of parts) {
    if (!p) continue
    const eq = p.indexOf('=')
    if (eq < 0) continue
    const key = p.slice(0, eq).trim().toLowerCase()
    let value = p.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (key) params[key] = value
  }
  return { type, params }
}

// Locate the first `=data` block with a matching `:key` attribute anywhere
// in the document tree.
function findDataBlockByKey(tree, key) {
  let found = null
  const walk = node => {
    if (found) return
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (!node || typeof node !== 'object') return
    if (node.type === 'block' && node.name === 'data') {
      const attrs = makeAttrs(node, {})
      if (attrs.getFirstValue('key') === key) {
        found = node
        return
      }
    }
    if (Array.isArray(node.content)) node.content.forEach(walk)
  }
  walk(tree)
  return found
}

function extractDataText(dataNode) {
  if (!dataNode || !Array.isArray(dataNode.content)) return ''
  const verbatim = dataNode.content.find(c => c && c.type === 'verbatim')
  return verbatim && typeof verbatim.value === 'string' ? verbatim.value : ''
}

// Detect whether the =table body is a single-line source reference like
// `data:key` or `file:path` (spec §1672). Returns the parsed reference or
// null if the body is ordinary table content.
function detectSourceReference(tableNode) {
  const texts = []
  const walker = makeTransformer({
    'row:text': r => {
      texts.push(r.value)
      return r
    },
    'head:text': h => {
      texts.push(h.value)
      return h
    },
  })
  walker(tableNode, {})
  const joined = texts.join('\n').trim()
  const lines = joined
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0)
  if (lines.length !== 1) return null
  const m = lines[0].match(/^(data|file):(\S+)$/)
  if (!m) return null
  return { scheme: m[1], target: m[2] }
}

function buildCellBlock(text) {
  return {
    name: 'cell',
    type: 'block',
    margin: '',
    content: [{ type: 'text', value: text }],
  }
}

function buildRowBlock(cells, isHeader) {
  const block: any = {
    name: 'row',
    type: 'block',
    margin: '',
    content: cells,
  }
  if (isHeader) {
    block.config = [{ name: 'header', value: true, type: 'boolean' }]
  }
  return block
}

// Convert parsed CSV/TSV rows to plain `=row`/`=cell` blocks. When
// `hasHeader` is true (signalled by the `header=present` MIME parameter on
// the source `=data` block, per RFC 4180 §3), the first row is marked with
// `:header`. Default behaviour leaves all rows unmarked, matching authors
// who use a structured table with explicit `=begin row :header` or a
// Markdown GFM table.
function csvToTableContent(csvRows, hasHeader = false) {
  return csvRows.map((row, i) => {
    const cells = row.map(v => buildCellBlock(v.trim()))
    return buildRowBlock(cells, hasHeader && i === 0)
  })
}

// ─── Error recovery (design notes Rules 2-4) ───────────────────────────────

// Rule 2 — table-level cell count validation. Pad short rows with empty
// cells; truncate long rows. Emit a warning whenever a row is changed.
// Expected count is taken from the `:header` row if present, otherwise from
// the row with the maximum cell count.
//
// Skipped when any cell uses `:colspan` or `:rowspan`: a spanning cell
// occupies multiple columns, so naive cell counting would misreport row
// width and drop legitimate spanned cells.
function normalizeCellCounts(tableNode, source = 'table') {
  if (!tableNode || !Array.isArray(tableNode.content)) return tableNode
  const rows = tableNode.content.filter(c => c && c.type === 'block' && c.name === 'row')
  if (rows.length === 0) return tableNode

  const cellsOf = row => (Array.isArray(row.content) ? row.content.filter(c => c && c.name === 'cell') : [])
  const isHeaderRow = row => Array.isArray(row.config) && row.config.some(a => a.name === 'header' && a.value === true)
  const cellHasSpan = cell =>
    Array.isArray(cell.config) && cell.config.some(a => a.name === 'colspan' || a.name === 'rowspan')
  const rowHasSpan = row => cellsOf(row).some(cellHasSpan)
  if (rows.some(rowHasSpan)) return tableNode

  const headerRow = rows.find(isHeaderRow)
  const expected = headerRow ? cellsOf(headerRow).length : Math.max(...rows.map(r => cellsOf(r).length))
  if (expected === 0) return tableNode

  let mutated = false
  const newContent = tableNode.content.map(child => {
    if (!child || child.type !== 'block' || child.name !== 'row') return child
    const cells = cellsOf(child)
    if (cells.length === expected) return child

    if (cells.length < expected) {
      const padding = []
      for (let i = cells.length; i < expected; i++) padding.push(buildCellBlock(''))
      console.warn(
        `[${source}] row has ${cells.length} cells, expected ${expected} — padded with ${padding.length} empty`,
      )
      mutated = true
      return { ...child, content: [...child.content, ...padding] }
    }

    // cells.length > expected → truncate
    const dropped = cells.length - expected
    console.warn(`[${source}] row has ${cells.length} cells, expected ${expected} — truncated ${dropped}`)
    mutated = true
    // Keep non-cell entries (e.g. blanklines) and the first `expected` cells
    let keepCells = expected
    const trimmed = []
    for (const c of child.content || []) {
      if (c && c.type === 'block' && c.name === 'cell') {
        if (keepCells > 0) {
          trimmed.push(c)
          keepCells--
        }
      } else {
        trimmed.push(c)
      }
    }
    return { ...child, content: trimmed }
  })

  return mutated ? { ...tableNode, content: newContent } : tableNode
}

// Rule 3 — mixed separator detection (text-mode only). Inspects each line
// for visible separators (`|` / `+`) surrounded by whitespace; lines without
// any visible separator fall back to whitespace separation. Warns when more
// than one separator type is observed within a single table.
function detectMixedSeparators(lines) {
  const seen = new Set<string>()
  for (const line of lines) {
    if (!line || typeof line !== 'string') continue
    if (/\s\|\s/.test(line)) seen.add('pipe')
    else if (/\s\+\s/.test(line)) seen.add('plus')
    else if (line.trim().length > 0) seen.add('whitespace')
    if (seen.size > 1) break
  }
  if (seen.size > 1) {
    console.warn(`[table] mixed separator types detected: ${Array.from(seen).join(', ')} — recommend a single style`)
  }
}

// Rule 4 — replace =table with =code block. Used when a referenced =data
// source has a non-CSV mime type: the spec mandates the source be rendered
// as a code block so the user can still see the underlying content.
function buildCodeFromDataBlock(tableNode, dataBlock) {
  return {
    type: 'block',
    name: 'code',
    margin: tableNode.margin || '',
    content: Array.isArray(dataBlock.content) ? dataBlock.content : [],
    config: Array.isArray(tableNode.config) ? tableNode.config : [],
  }
}
/**
 *  Helpers section
 */

// Bit-mask helper used by the positional column extractor for multi-line
// rows. Compares two same-length digit strings character by character via
// `cb`, returning the joined result.
const strbin = (str1, str2, cb) => {
  let res = []
  for (let i = 0; str1.length > i; i++) {
    res.push(cb(parseInt(str1[i], 10), parseInt(str2[i], 10)))
  }
  return res.join('')
}

// Build a unified column-position mask across a set of lines. Used as a
// fallback when a row spans multiple lines (continuation lines that align
// content by character position rather than by separator). Returns a binary
// string where `0` runs mark column ranges and `1` runs mark gaps.
const makeMask = (lines: string[], separators: string[]): string => {
  const tmplLength = Math.max(...[...lines, ...separators].map(s => s.length))
  const masks = lines.map(str => {
    const tstr = str + ' '.repeat(tmplLength - str.length)
    const mask: string[] = []
    const re = /\s+[+|\s]\s/g
    let match
    while ((match = re.exec(tstr)) != null) {
      const tmpMask = '1'.repeat(match.index) + '0'.repeat(match[0].length)
      mask.push(tmpMask + '1'.repeat(tmplLength - tmpMask.length))
    }
    return mask.reduce((a, b) => strbin(a, b, (i1, i2) => i1 & i2), '1'.repeat(tmplLength))
  })
  const inverted = masks.map(m => strbin(m, '', i1 => (i1 == 0 ? 1 : 0)))
  return inverted.reduce((a, b) => strbin(a, b, (i1, i2) => i1 & i2), '1'.repeat(tmplLength))
}

// Apply a column-position template to a multi-line text block, extracting
// per-column substrings and aggregating across lines (continuation lines
// append to the cell at the same column position).
const extractColumnsByTemplate = (text: string, template: string): string[] => {
  const lines = flattenDeep(text.split(/\n/).filter(s => s.length > 0))
  const cols = lines.map(line => {
    const re = /((1+|0+))/g
    const columns: string[] = []
    let match
    while ((match = re.exec(template)) != null) {
      if (match[0][0] == '1') continue
      columns.push(line.substring(match.index, match.index + match[0].length))
    }
    return columns
  })
  const result: string[] = []
  cols.reduce((a, b) => {
    for (let i = 0; i < b.length; i++) {
      a[i] = (a[i] === undefined ? '' : a[i]) + ' ' + b[i]
    }
    return a
  }, result)
  return result
}

/*
=begin pod

=head2 Scenario 2 — header with C<|>, data rows with whitespace

Authors sometimes mark the header row with C<|> for visual emphasis and
align data rows by whitespace alone. The two row styles disagree on
column boundaries.

=begin code
=begin table
Name | Age | City
Alice  30    London
Bob    25    Paris
=end table
=end code

A unified positional mask collapses this table because the header's pipe
positions and the whitespace runs in data rows do not intersect to
meaningful columns. Per-line detection treats each line on its own:

=begin code
Name | Age | City    →  pipe split        →  ["Name", "Age", "City"]
Alice  30    London  →  whitespace split  →  ["Alice", "30", "London"]
Bob    25    Paris   →  whitespace split  →  ["Bob", "25", "Paris"]
=end code

Three rows, three cells each. Rule 3 still warns about mixed separator
types so the author can normalise the source if they want; parsing
succeeds either way.

This routing activates when at least one line uses a visible separator
(C<|> or C<+>) and at least one uses whitespace. Tables with a single
separator type, or with both visible separators mixed in one table
(the shared mask handles those), go through the legacy positional path
so continuation lines in multi-line rows keep their column alignment.

=end pod
*/

// Per-line column-separator detection (spec §Tables Rule 1).
// Each line in a text-mode table independently determines its column
// separator: visible `|` or `+` surrounded by whitespace, otherwise two or
// more consecutive whitespace characters. Lines in the same row may use
// different visible separators (Rule 3 warns); per-line splitting still
// produces consistent cell counts because each line is parsed in isolation.

type SeparatorKind = 'pipe' | 'plus' | 'whitespace'

const detectLineSeparator = (line: string): SeparatorKind => {
  if (/(?:^|\s)\|(?:\s|$)/.test(line)) return 'pipe'
  if (/(?:^|\s)\+(?:\s|$)/.test(line)) return 'plus'
  return 'whitespace'
}

const trimEdgeEmpty = (cells: string[]): string[] => {
  // A leading `|` produces an empty cell at index 0; a trailing `|` does the
  // same at the end. Drop those edge artifacts. Empty cells in the middle of
  // the row are preserved.
  let start = 0
  let end = cells.length
  if (cells[start] === '') start++
  if (end > start && cells[end - 1] === '') end--
  return cells.slice(start, end)
}

const splitLineByPipe = (line: string): string[] => trimEdgeEmpty(line.split(/\s*\|\s*/).map(c => c.trim()))

const splitLineByPlus = (line: string): string[] => trimEdgeEmpty(line.split(/\s*\+\s*/).map(c => c.trim()))

const splitLineByWhitespace = (line: string): string[] =>
  line
    .trim()
    .split(/\s{2,}/)
    .filter(c => c !== '')

const splitLineCells = (line: string): string[] => {
  const trimmed = line.trim()
  if (trimmed === '') return []
  const kind = detectLineSeparator(line)
  if (kind === 'pipe') return splitLineByPipe(line)
  if (kind === 'plus') return splitLineByPlus(line)
  return splitLineByWhitespace(line)
}

// Convert a row's raw text (which may span multiple lines) to cell values.
// Multi-line rows: take the separator kind from the first non-blank line and
// apply it to every line of the row, then aggregate column-wise so that a
// continuation line (e.g. wrapped cell content) appends to the cell from the
// previous line in the same column.
const rowToCells = (rowValue: string): string[] => {
  const lines = rowValue.split(/\r?\n/).filter(l => l.trim() !== '')
  if (lines.length === 0) return []
  if (lines.length === 1) return splitLineCells(lines[0])

  const kind = detectLineSeparator(lines[0])
  const splitFn = kind === 'pipe' ? splitLineByPipe : kind === 'plus' ? splitLineByPlus : splitLineByWhitespace
  const lineCells = lines.map(splitFn)

  const maxCols = Math.max(...lineCells.map(c => c.length))
  const merged: string[] = []
  for (let i = 0; i < maxCols; i++) {
    const parts = lineCells.map(line => line[i] ?? '').filter(p => p !== '')
    merged.push(parts.join(' '))
  }
  return merged
}

/**
 *  Main transforms
 */

const wrapImplicitCells = rowNode => {
  if (!Array.isArray(rowNode.content) || rowNode.content.length === 0) return rowNode
  const hasNonCell = rowNode.content.some(c => c && c.type === 'block' && c.name !== 'cell' && c.name !== 'blankline')
  if (!hasNonCell) return rowNode
  const wrapped = rowNode.content.map(c => {
    if (!c || c.type !== 'block') return c
    if (c.name === 'cell' || c.name === 'blankline') return c
    return { type: 'block', name: 'cell', content: [c], margin: c.margin || '' }
  })
  return { ...rowNode, content: wrapped }
}

const isStructured = tableNode =>
  Array.isArray(tableNode.content) &&
  tableNode.content.some(c => c && c.type === 'block' && (c.name === 'row' || c.name === 'cell'))

export default () => tree => {
  const transformer = makeTransformer({
    table: node => {
      // CSV/data source reference (spec §1672):
      //   =table data:<key>      →  resolve =data block with :key<key>
      //   =table file:<path>     →  defer to host reader (not implemented here)
      const ref = detectSourceReference(node)
      if (ref && ref.scheme === 'data') {
        const dataBlock = findDataBlockByKey(tree, ref.target)
        if (!dataBlock) {
          // Rule 4: source not found → empty table (still a =table block)
          console.warn(`[table] no =data block found for data:${ref.target} — rendered as empty`)
          return { ...node, content: [] }
        }
        const rawMime = makeAttrs(dataBlock, {}).getFirstValue('mime-type')
        const { type: mimeType, params: mimeParams } = parseMimeType(rawMime)
        const isCsv = mimeType === 'text/csv'
        const isTsv = mimeType === 'text/tab-separated-values'
        if (isCsv || isTsv) {
          const text = extractDataText(dataBlock)
          const rows = isCsv ? parseCsv(text) : parseTsv(text)
          if (rows.length === 0) {
            console.warn(
              `[table] ${isCsv ? 'CSV' : 'TSV'} parse produced no rows for data:${ref.target} — rendered as empty`,
            )
            return { ...node, content: [] }
          }
          const hasHeader = mimeParams.header === 'present'
          const filledNode = { ...node, content: csvToTableContent(rows, hasHeader) }
          return normalizeCellCounts(filledNode, `table data:${ref.target}`)
        }
        // Rule 4: source not tabular → render as code block so content remains visible
        console.warn(
          `[table] =data :key<${ref.target}> has non-tabular mime-type ${rawMime || '(none)'} — rendered as =code`,
        )
        return buildCodeFromDataBlock(node, dataBlock)
      }

      // structured mode: transform row children (wrap implicit cells), then
      // apply Rule 2 cell count normalization.
      if (isStructured(node)) {
        const transformedContent = (node.content || []).map(c => {
          if (c && c.name === 'row') return wrapImplicitCells(c)
          return c
        })
        return normalizeCellCounts({ ...node, content: transformedContent }, 'table')
      }
      let rows = []
      const collectValues = row => {
        rows.push(row.value)
      }
      // collect separators for calculate max length of rows
      let seps = []
      makeTransformer({
        'row:text': collectValues,
        'head:text': collectValues,
        ':separator': sep => {
          seps.push(sep.text)
        },
      })(node)
      // add table-caption
      // if table empty return node as is
      if (!rows.length) return node

      const splitToLines = row =>
        row
          .split(/\n/) // split each row by eol
          .filter(str => str.length > 0) // filter empty strings ( after slit )

      // split each row into lines
      const lines = flattenDeep(rows.map(splitToLines))
      const separators = flattenDeep(seps.map(splitToLines))

      // Rule 3: warn on mixed separator types within a single table
      detectMixedSeparators(lines)

      // collect text rows
      let textRows = []
      makeTransformer({
        'row:text': row => {
          textRows.push(row.value)
        },
      })(node)

      const makeBlock = (name, content, extra = {}) => {
        return { ...extra, name, type: 'block', content: Array.isArray(content) ? content : [content] }
      }
      const makeRow = cells => makeBlock('row', cells)
      const makeHeaderRow = cells =>
        makeBlock('row', cells, { config: [{ name: 'header', value: true, type: 'boolean' }] })
      const makeCell = text => makeBlock('cell', { type: 'text', value: text })
      // Routing: per-line separator detection (Rule 1) is used only when a
      // line with a visible separator (`|` or `+`) coexists with one that
      // has only whitespace separation — the Scenario 2 case where the
      // legacy positional mask collapses columns. Tables with a uniform
      // separator, or with both visible kinds (pipe + plus) handled by the
      // shared mask, fall back to the legacy positional template, which
      // preserves continuation-line alignment in multi-line rows and keeps
      // byte-for-byte AST/HTML output stable.
      const columnTemplate = makeMask(lines, separators)
      const seenSeparatorKinds = new Set(lines.map(detectLineSeparator))
      const hasVisible = seenSeparatorKinds.has('pipe') || seenSeparatorKinds.has('plus')
      const hasWhitespace = seenSeparatorKinds.has('whitespace')
      const useMixedSplitting = hasVisible && hasWhitespace
      const splitToCells = (rowValue: string): string[] => {
        if (useMixedSplitting) {
          const rowLines = rowValue.split(/\r?\n/).filter(l => l.trim() !== '')
          if (rowLines.length <= 1) return rowToCells(rowValue)
        }
        return extractColumnsByTemplate(rowValue, columnTemplate)
      }
      const res = makeTransformer({
        'row:text': row => {
          if (textRows.length == 1) {
            // No separator blocks: each line of the only text row becomes its own row
            const textRowsLines = flattenDeep([row.value].map(splitToLines))
            if (useMixedSplitting) {
              return textRowsLines.map(line => makeRow(splitLineCells(line).map(makeCell)))
            }
            return textRowsLines.map(line => makeRow(extractColumnsByTemplate(line, columnTemplate).map(makeCell)))
          }
          return makeRow(splitToCells(row.value).map(makeCell))
        },
        'head:text': head => makeHeaderRow(splitToCells(head.value).map(makeCell)),
      })(node)

      return normalizeCellCounts(res, 'table')
    },
  })
  return transformer(tree, {})
}
