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

// Convert parsed CSV rows to `=row`/`=cell` blocks. If `headerFirst` is set,
// the first row is marked `:header`.
function csvToTableContent(csvRows, headerFirst) {
  return csvRows.map((row, i) => {
    const cells = row.map(v => buildCellBlock(v.trim()))
    return buildRowBlock(cells, headerFirst && i === 0)
  })
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
        if (dataBlock) {
          const mimeType = makeAttrs(dataBlock, {}).getFirstValue('mime-type')
          if (mimeType === 'text/csv') {
            const csvRows = parseCsv(extractDataText(dataBlock))
            if (csvRows.length > 0) {
              const headerFirst = makeAttrs(node, {}).getFirstValue('header') === true
              return { ...node, content: csvToTableContent(csvRows, headerFirst) }
            }
          } else {
            console.warn(`[table] =data :key<${ref.target}> has unsupported mime-type: ${mimeType || '(none)'}`)
          }
        } else {
          console.warn(`[table] no =data block found for data:${ref.target}`)
        }
        // Fall through to normal processing if resolution failed
      }

      // structured mode: transform row children (wrap implicit cells)
      if (isStructured(node)) {
        const transformedContent = (node.content || []).map(c => {
          if (c && c.name === 'row') return wrapImplicitCells(c)
          return c
        })
        return { ...node, content: transformedContent }
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

      return res
    },
  })
  return transformer(tree, {})
}
