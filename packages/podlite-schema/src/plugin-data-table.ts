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

export default () => tree => {
  const transformer = makeTransformer({
    'data-table': node => {
      return node
    },
  })
  return transformer(tree)
}
