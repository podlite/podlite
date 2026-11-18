import makeTransformer from './helpers/makeTransformer'
import makeAttrs from './helpers/config'
import {
  parseMimeType,
  findDataBlockByKey,
  extractDataText,
  csvToTableContent,
  normalizeCellCounts,
  makeTableReport,
  readTabular,
  reportHeaderOf,
  buildCodeFromText,
} from './plugin-tables'

// a MIME type inferred from a file extension has no parameters
const extensionMimeMap: Record<string, string> = {
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  tab: 'text/tab-separated-values',
}

function inferMimeFromExtension(path: string): string | undefined {
  const m = path.match(/\.([a-z0-9]+)$/i)
  if (!m) return undefined
  return extensionMimeMap[m[1].toLowerCase()]
}

// The spaces around the items of a comma list are the syntax of the list; a
// single value keeps its spaces, which are part of a column name.
function parseColumnsList(values: any[]): string[] {
  if (!Array.isArray(values) || values.length === 0) return []
  if (values.length === 1 && typeof values[0] === 'string' && values[0].includes(',')) {
    return values[0]
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0)
  }
  return values.map(v => String(v)).filter(s => s.trim().length > 0)
}

function resolveColumnIndex(col: string, headerRow: string[] | null, maxCols: number): number {
  if (/^\d+$/.test(col)) {
    const n = parseInt(col, 10)
    const idx = n - 1
    if (idx < 0 || idx >= maxCols) {
      throw new Error(`column index ${n} out of range (1..${maxCols})`)
    }
    return idx
  }
  if (!headerRow) {
    throw new Error(`column name "${col}" requires header=present`)
  }
  const idx = headerRow.indexOf(col)
  if (idx === -1) {
    const names = headerRow.map(h => `"${h}"`).join(', ')
    throw new Error(`column name "${col}" not found in header; header has ${names}`)
  }
  return idx
}

// without a header the widest row sets the width, so no value of a longer row is lost
const sourceWidth = (rows: string[][], hasHeader: boolean): number =>
  hasHeader ? rows[0].length : rows.reduce((widest, row) => Math.max(widest, row.length), 0)

// A row of the source wider or narrower than the source is reported by its place
// among the source records, the header row first; a table showing chosen columns
// neither pads nor drops the row, so its report says only what the source holds.
function reportSourceWidths(rows: string[][], width: number, projected: boolean, report, node) {
  rows.forEach((row, i) => {
    if (row.length === width) return
    const place = `data-table ${projected ? 'source ' : ''}row ${i + 1} has ${row.length} of ${width} cells`
    const repair = row.length < width ? `, padded with ${width - row.length} empty` : `, dropped ${row.length - width}`
    report('table-row-cells', projected ? place : place + repair, node)
  })
}

function renameLabels(
  rename: Record<string, string>,
  shown: number[],
  headerRow: string[] | null,
  width: number,
): string[] {
  const given = new Map<number, string>()
  for (const [key, newName] of Object.entries(rename)) {
    const idx = resolveColumnIndex(key, headerRow, width)
    if (!shown.includes(idx)) throw new Error(`:rename names column ${key}, which :columns leaves out`)
    const earlier = given.get(idx)
    if (earlier !== undefined && earlier !== String(newName)) {
      throw new Error(`:rename gives column ${key} two names, "${earlier}" and "${newName}"`)
    }
    given.set(idx, String(newName))
  }
  return shown.map(i => given.get(i) ?? (headerRow ? headerRow[i] ?? '' : String(i + 1)))
}

function processDataTable(node, tree, report) {
  const attrs = makeAttrs(node, {})
  const srcRaw = attrs.getFirstValue('src')
  const mimeAttr = attrs.getFirstValue('mime-type')
  const renameMap = attrs.getMapValue('rename')
  const columnsPresent = attrs.exists('columns')
  const columns = columnsPresent ? parseColumnsList(attrs.getAllValues('columns')) : null
  const bodyText = extractDataText(node)

  // a blank line is body content too, and an empty :src is an option all the same
  if (attrs.exists('src') && bodyText.length > 0) {
    report(
      'table-source-conflict',
      ':src and a body are both given; a data table takes its rows from one of them',
      node,
      'error',
    )
    return { ...node, name: 'table', content: [] }
  }

  if (columnsPresent && (!columns || columns.length === 0)) {
    throw new Error(':columns must have at least one entry; omit the attribute to render all columns')
  }

  let csvText: string
  let mimeType: string
  let mimeParams: Record<string, string>
  let carryCover = built => built

  if (srcRaw) {
    const srcStr = String(srcRaw)
    const m = srcStr.match(/^(file|data|http|https|doc):(.+)$/)
    const scheme = m ? m[1] : 'file'
    const target = m ? m[2] : srcStr

    if (scheme === 'data') {
      const dataBlock = findDataBlockByKey(tree, target)
      if (!dataBlock) {
        report('table-source-unreadable', `no =data block found for data:${target}, table rendered as empty`, node)
        return { ...node, name: 'table', content: [] }
      }
      // the format of the referenced block yields only to one written on the table itself
      const own = (Array.isArray(node.config) ? node.config : []).find(c => c && c.name === 'mime-type')
      const dataMime = own && own.from === undefined ? mimeAttr : makeAttrs(dataBlock, {}).getFirstValue('mime-type')
      if (!dataMime) {
        report('table-source-unreadable', `=data block ${target} has no :mime-type, table rendered as empty`, node)
        return { ...node, name: 'table', content: [] }
      }
      const parsed = parseMimeType(dataMime)
      mimeType = parsed.type
      mimeParams = parsed.params
      // a header written on the source is reported at the source
      if (own && own.from === undefined) reportHeaderOf(mimeType, mimeParams, '=data-table', node, report)
      csvText = extractDataText(dataBlock)
      // whatever is built out of a covered =data block is covered as well
      if (makeAttrs(dataBlock, {}).getFirstValue('masked')) carryCover = built => ({ ...built, guarded: true })
    } else {
      return node
    }
  } else {
    if (!mimeAttr) {
      throw new Error('inline body requires :mime-type')
    }
    const parsed = parseMimeType(mimeAttr)
    mimeType = parsed.type
    mimeParams = parsed.params
    reportHeaderOf(mimeType, mimeParams, '=data-table', node, report)
    csvText = bodyText
  }

  const isCsv = mimeType === 'text/csv'
  const isTsv = mimeType === 'text/tab-separated-values'
  // content that is not tabular is shown as written, as =table shows it
  if (!isCsv && !isTsv) {
    report('table-source-unreadable', `unsupported mime-type ${mimeType}, rendered as =code`, node)
    return carryCover(buildCodeFromText(node, csvText))
  }
  const read = readTabular(isCsv, mimeParams, csvText, srcRaw ? String(srcRaw) : 'the body', node, report)
  if (!read) return carryCover(buildCodeFromText(node, csvText))
  const hasHeader = read.hasHeader
  const rows = read.rows
  const rename = renameMap ? Object.entries(renameMap as Record<string, string>) : []
  if (rows.length === 0) {
    if (rename.length > 0) throw new Error(`:rename names column ${rename[0][0]}, which the source does not have`)
    report('table-source-empty', `${isCsv ? 'CSV' : 'TSV'} source has no rows, table rendered as empty`, node)
    return carryCover({ ...node, name: 'table', content: [] })
  }

  const width = sourceWidth(rows, hasHeader)
  const headerRow = hasHeader ? rows[0] : null
  const shown = columns ? columns.map(col => resolveColumnIndex(col, headerRow, width)) : null
  const data = hasHeader ? rows.slice(1) : rows
  const projected = shown ? data.map(row => shown.map(i => row[i] ?? '')) : data
  let labels: string[] | null = headerRow && (shown ? shown.map(i => headerRow[i] ?? '') : headerRow)
  // a :rename, an empty one too, labels the columns of a source without a header
  if (attrs.exists('rename')) {
    const all = Array.from({ length: width }, (_, i) => i)
    labels = renameLabels(Object.fromEntries(rename), shown ?? all, headerRow, width)
  }

  // reported once the columns and the labels are known to be readable
  reportSourceWidths(rows, width, shown !== null, report, node)

  const filledNode = {
    ...node,
    name: 'table',
    content: csvToTableContent(
      labels ? [labels, ...projected] : projected,
      labels !== null,
      attrs.getAllValues('allow'),
    ),
  }
  // the rows of the source are reported above, by their place in the source
  return carryCover(normalizeCellCounts(filledNode, 'data-table', () => {}, 'data-table'))
}

export default (opt = {}) =>
  tree => {
    const report = makeTableReport(opt)
    const transformer = makeTransformer({
      'data-table': node => {
        try {
          return processDataTable(node, tree, report)
        } catch (err) {
          report('table-source-unreadable', (err as Error).message, node)
          return { ...node, name: 'table', content: [] }
        }
      },
    })
    return transformer(tree)
  }
