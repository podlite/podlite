import { applyNumberedShorthand, isBeforeText } from './helpers/numberedShorthand'
import { stripMarker } from './helpers/stripMarker'

export default () => tree => {
  const visit = node => {
    if (Array.isArray(node)) {
      node.forEach(i => {
        visit(i)
      })
    } else {
      if (node && node.type === 'block') {
        const matchItem = /^item(\d+)?/.exec(node.name)
        if (matchItem) {
          node.name = 'item'
          node.level = matchItem[1] || 1

          // Check :checked / :!checked config attribute
          const checkedConfig = (node.config || []).find(c => c.name === 'checked')
          if (checkedConfig) {
            node.checked = checkedConfig.value !== false && checkedConfig.value !== 0 && checkedConfig.value !== '0'
          }

          // the first text of the item, as for the # shorthand: only a paragraph carries a check box
          const startText = node.content.find(child => !isBeforeText(child))
          if (startText?.type === 'para') {
            if (typeof startText.text === 'string' && startText.text) {
              // Check for checkbox syntax [x] or [ ] at start of text
              if (!checkedConfig) {
                const checkboxRe = /^\[( |x)\]\s*/
                const checkboxMatch = checkboxRe.exec(startText.text)
                if (checkboxMatch) {
                  node.checked = checkboxMatch[1] === 'x'
                  stripMarker(startText, checkboxRe)
                  node.config = node.config || []
                  node.config.push({
                    name: 'checked',
                    value: node.checked,
                    type: 'boolean',
                  })
                }
              }
            }
          }
          applyNumberedShorthand(node)
        }
        visit(node.content)
      }
    }
  }
  visit(tree)
  return tree
}
