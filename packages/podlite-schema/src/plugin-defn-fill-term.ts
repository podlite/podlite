/**
 * Plugin for fill term's for defn. From S26:
 * The first non-blank line of content is treated as a term being defined,
 * and the remaining content is treated as the definition for the term.
 */
import makeTransformer from './helpers/makeTransformer'
import { applyNumberedShorthand, isBeforeText } from './helpers/numberedShorthand'
export default () => tree => {
  const transformer = makeTransformer({
    defn: node => {
      // get first non blank block
      const content = node.content

      // skip all blank blocks
      const count = content.length
      let newContent = []
      let isFirstParaProcessed = false
      // a leading # numbers the definition only when the term is the first text of the block
      let termComesFirst = true
      for (let i = 0; i < count; i++) {
        const item = content[i]
        // the term is the first line even when an indent made the parser read it as code;
        // the rest stays code and starts on the next line of the source
        if (item.type === 'code' && !isFirstParaProcessed) {
          const verbatim = item.content[0]
          const value: string = verbatim.value
          const end = value.match(/\r\n|\r|\n/)
          const term = end ? value.slice(0, end.index) : value
          const rest = end ? value.slice(end.index + end[0].length) : ''
          const newTermPara = { type: 'para', name: 'term', text: term, content: [{ type: 'text', value: term }] }
          if (termComesFirst) applyNumberedShorthand(node, newTermPara)
          newContent.push(newTermPara)
          if (rest !== '') {
            verbatim.value = rest
            item.text = rest
            const start = item.location && item.location.start
            if (start && end)
              item.location = {
                ...item.location,
                start: {
                  offset: start.offset + String(item.margin || '').length + term.length + end[0].length,
                  line: start.line + 1,
                  column: 1,
                },
              }
            newContent.push(item)
          }
          isFirstParaProcessed = true
        } else if (item.type === 'para' && !isFirstParaProcessed) {
          // get text content
          const textNode = item.content[0]
          const text = textNode.value
          // split text by lines
          // get first line
          const splited = text.split('\n')
          const term = splited.shift()
          const newTermPara = {
            type: 'para',
            name: 'term',
            text: term,
            content: [{ type: 'text', value: term }],
          }
          if (termComesFirst) applyNumberedShorthand(node, newTermPara)
          newContent.push(newTermPara)
          if (!(splited.length == 1 && splited[0] === '')) {
            textNode.value = splited.join('\n')
            item.text = textNode.value
            newContent.push(item)
          }
          isFirstParaProcessed = true
        } else {
          if (!isFirstParaProcessed && !isBeforeText(item)) termComesFirst = false
          newContent.push(item)
        }
      }
      node.content = newContent
      return node
    },
  })
  return transformer(tree, {})
}
