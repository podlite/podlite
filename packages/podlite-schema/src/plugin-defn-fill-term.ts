/**
 * Plugin for fill term's for defn. From S26:
 * The first non-blank line of content is treated as a term being defined,
 * and the remaining content is treated as the definition for the term.
 */
import makeTransformer from './helpers/makeTransformer'
export default () => tree => {
  const transformer = makeTransformer({
    defn: node => {
      // get first non blank block
      const content = node.content

      // skip all blank blocks
      const count = content.length
      let newContent = []
      let isFirstParaProcessed = false
      for (let i = 0; i < count; i++) {
        const item = content[i]
        if (item.type === 'para' && !isFirstParaProcessed) {
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
          newContent.push(newTermPara)
          if (!(splited.length == 1 && splited[0] === '')) {
            textNode.value = splited.join('\n')
            item.text = textNode.value
            newContent.push(item)
          }
          isFirstParaProcessed = true
        } else {
          newContent.push(item)
        }
      }
      node.content = newContent
      return node
    },
  })
  return transformer(tree, {})
}
