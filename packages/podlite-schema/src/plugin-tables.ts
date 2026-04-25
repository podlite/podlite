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

// Convert parsed CSV/TSV rows to plain `=row`/`=cell` blocks. The spec is
// silent on how to mark a header row in `=table data:<key>` references, so
// no row receives `:header` here. Authors who need a header row can use a
// structured table with explicit `=begin row :header`, or a Markdown GFM
// table with a separator line.
function csvToTableContent(csvRows) {
  return csvRows.map(row => {
    const cells = row.map(v => buildCellBlock(v.trim()))
    return buildRowBlock(cells, false)
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

// run cb in symbols pair
const strbin = (str1, str2, cb) => {
  let res = []
  for (let i = 0; str1.length > i; i++) {
    res.push(cb(parseInt(str1[i], 10), parseInt(str2[i], 10)))
  }
  return res.join('')
}

// Create mask for extract columns
const makeMask = (lines, separators) => {
  // calculate template length
  const tmplLength = Math.max(...[...lines, ...separators].map(s => s.length))
  // make bin mask for each string
  const masks = lines.map(str => {
    /** make mask for each line
                '        The Shoveller | Eddie Stevens   | King Arthur\'s singing shovel', 
                '0000000011111111111110001111111111111000001111111111111111111111111111' ] 
                then  not(mask) ... then  & masks
               */
    // enlarge string to tmplLength
    let tstr = str + ' '.repeat(tmplLength - str.length)
    let mask = []
    const re = /\s+[+|\s]\s/g
    let match
    while ((match = re.exec(tstr)) != null) {
      const tmpMask = '1'.repeat(match.index) + '0'.repeat(match[0].length)
      mask.push(tmpMask + '1'.repeat(tmplLength - tmpMask.length))
    }
    return mask.reduce((a, b) => {
      return strbin(a, b, (i1, i2) => i1 & i2)
    }, '1'.repeat(tmplLength))
  })
  // make result mask
  const inverted = masks.map(m => strbin(m, '', i1 => (i1 == 0 ? 1 : 0)))
  const columnTemplate = inverted.reduce((a, b) => {
    return strbin(a, b, (i1, i2) => i1 & i2)
  }, '1'.repeat(tmplLength))
  return columnTemplate
}

const extractColumnsByTemplate = (text, template) => {
  const lines = flattenDeep(
    text
      .split(/\n/) // split each row by eol
      .filter(str => str.length > 0), // filter empty strings ( after slit )
  )
  const cols = lines.map(line => {
    const re = /((1+|0+))/g
    let columns = []
    let match
    while ((match = re.exec(template)) != null) {
      if (match[0][0] == 1) continue
      const s = line.substring(match.index, match.index + match[0].length)
      columns.push(s)
    }
    return columns
  })
  let result = []
  result = cols.reduce((a, b) => {
    for (let i = 0; i < b.length; i++) {
      a[i] = (a[i] === undefined ? '' : a[i]) + ' ' + b[i]
    }
    return a
  }, [])
  return result
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
        const mimeType = makeAttrs(dataBlock, {}).getFirstValue('mime-type')
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
          const filledNode = { ...node, content: csvToTableContent(rows) }
          return normalizeCellCounts(filledNode, `table data:${ref.target}`)
        }
        // Rule 4: source not tabular → render as code block so content remains visible
        console.warn(
          `[table] =data :key<${ref.target}> has non-tabular mime-type ${mimeType || '(none)'} — rendered as =code`,
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

      const columnTemplate = makeMask(lines, separators)
      const makeBlock = (name, content, extra = {}) => {
        return { ...extra, name, type: 'block', content: Array.isArray(content) ? content : [content] }
      }
      const makeRow = cells => makeBlock('row', cells)
      const makeHeaderRow = cells =>
        makeBlock('row', cells, { config: [{ name: 'header', value: true, type: 'boolean' }] })
      const makeCell = text => makeBlock('cell', { type: 'text', value: text })
      // make columns
      const res = makeTransformer({
        'row:text': row => {
          if (textRows.length == 1) {
            // split each text row into lines
            const textRowsLines = flattenDeep([row.value].map(splitToLines))
            return textRowsLines.map(rowValue => {
              const cols = extractColumnsByTemplate(rowValue, columnTemplate)
              return makeRow(cols.map(makeCell))
            })
          }
          const cols = extractColumnsByTemplate(row.value, columnTemplate)
          return makeRow(cols.map(makeCell))
        },
        'head:text': head => {
          const cols = extractColumnsByTemplate(head.value, columnTemplate)
          return makeHeaderRow(cols.map(makeCell))
        },
      })(node)

      return normalizeCellCounts(res, 'table')
    },
  })
  return transformer(tree, {})
}
