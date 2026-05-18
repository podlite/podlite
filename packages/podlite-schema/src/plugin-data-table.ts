import makeTransformer from './helpers/makeTransformer'
import makeAttrs from './helpers/config'
import {
  parseCsv,
  parseTsv,
  parseMimeType,
  findDataBlockByKey,
  extractDataText,
  csvToTableContent,
  normalizeCellCounts,
} from './plugin-tables'

const extensionMimeMap: Record<string, string> = {
  csv: 'text/csv; header=present',
  tsv: 'text/tab-separated-values; header=present',
  tab: 'text/tab-separated-values; header=present',
}

function inferMimeFromExtension(path: string): string | undefined {
  const m = path.match(/\.([a-z0-9]+)$/i)
  if (!m) return undefined
  return extensionMimeMap[m[1].toLowerCase()]
}

function parseColumnsList(values: any[]): string[] {
  if (!Array.isArray(values) || values.length === 0) return []
  if (values.length === 1 && typeof values[0] === 'string' && values[0].includes(',')) {
    return values[0]
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0)
  }
  return values.map(v => String(v).trim()).filter(s => s.length > 0)
}

function resolveColumnIndex(col: string, headerRow: string[] | null, maxCols: number): number {
  const trimmed = col.trim()
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10)
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
    throw new Error(`column name "${col}" not found in header`)
  }
  return idx
}

function projectColumns(rows: string[][], columns: string[], hasHeader: boolean): string[][] {
  if (rows.length === 0) return rows
  const maxCols = rows[0].length
  const headerRow = hasHeader ? rows[0] : null
  const indices = columns.map(col => resolveColumnIndex(col, headerRow, maxCols))
  return rows.map(row => indices.map(i => row[i] ?? ''))
}

function applyRename(rows: string[][], rename: Record<string, string>, hasHeader: boolean): string[][] {
  if (!hasHeader || rows.length === 0) return rows
  const headerRow = [...rows[0]]
  for (const [key, newName] of Object.entries(rename)) {
    const idx = resolveColumnIndex(key, headerRow, headerRow.length)
    headerRow[idx] = String(newName)
  }
  return [headerRow, ...rows.slice(1)]
}

function processDataTable(node, tree) {
  const attrs = makeAttrs(node, {})
  const srcRaw = attrs.getFirstValue('src')
  const mimeAttr = attrs.getFirstValue('mime-type')
  const renameMap = attrs.getMapValue('rename')
  const columnsPresent = attrs.exists('columns')
  const columns = columnsPresent ? parseColumnsList(attrs.getAllValues('columns')) : null
  const bodyText = extractDataText(node)
  const hasInlineBody = bodyText.trim().length > 0

  if (srcRaw && hasInlineBody) {
    throw new Error(':src and inline body are mutually exclusive')
  }

  if (columnsPresent && (!columns || columns.length === 0)) {
    throw new Error(':columns must have at least one entry; omit the attribute to render all columns')
  }

  let csvText: string
  let mimeType: string
  let hasHeader: boolean

  if (srcRaw) {
    const srcStr = String(srcRaw)
    const m = srcStr.match(/^(file|data|http|https|doc):(.+)$/)
    const scheme = m ? m[1] : 'file'
    const target = m ? m[2] : srcStr

    if (scheme === 'data') {
      const dataBlock = findDataBlockByKey(tree, target)
      if (!dataBlock) {
        console.warn(`[data-table] no =data block found for data:${target} — rendered as empty`)
        return { ...node, name: 'table', content: [] }
      }
      if (mimeAttr) {
        throw new Error(`:mime-type cannot be declared with :src<data:${target}> (inherited from referenced block)`)
      }
      const dataMime = makeAttrs(dataBlock, {}).getFirstValue('mime-type')
      if (!dataMime) {
        console.warn(`[data-table] =data block ${target} has no :mime-type — rendered as empty`)
        return { ...node, name: 'table', content: [] }
      }
      const parsed = parseMimeType(dataMime)
      mimeType = parsed.type
      hasHeader = parsed.params.header === 'present'
      csvText = extractDataText(dataBlock)
    } else {
      return node
    }
  } else {
    if (!mimeAttr) {
      throw new Error('inline body requires :mime-type')
    }
    const parsed = parseMimeType(mimeAttr)
    mimeType = parsed.type
    hasHeader = parsed.params.header === 'present'
    csvText = bodyText
  }

  const isCsv = mimeType === 'text/csv'
  const isTsv = mimeType === 'text/tab-separated-values'
  if (!isCsv && !isTsv) {
    console.warn(`[data-table] unsupported mime-type ${mimeType} — rendered as empty`)
    return { ...node, name: 'table', content: [] }
  }
  let rows = isCsv ? parseCsv(csvText) : parseTsv(csvText)
  if (rows.length === 0) {
    console.warn(`[data-table] ${isCsv ? 'CSV' : 'TSV'} parse produced no rows — rendered as empty`)
    return { ...node, name: 'table', content: [] }
  }

  if (columns) {
    rows = projectColumns(rows, columns, hasHeader)
  }

  if (renameMap) {
    rows = applyRename(rows, renameMap as Record<string, string>, hasHeader)
  }

  const filledNode = { ...node, name: 'table', content: csvToTableContent(rows, hasHeader) }
  return normalizeCellCounts(filledNode, 'data-table')
}

export default () => tree => {
  const transformer = makeTransformer({
    'data-table': node => {
      try {
        return processDataTable(node, tree)
      } catch (err) {
        console.warn(`[data-table] ${(err as Error).message}`)
        return { ...node, name: 'table', content: [] }
      }
    },
  })
  return transformer(tree)
}
