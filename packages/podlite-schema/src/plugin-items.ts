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

          if (node.content[0]) {
            const startText = node.content[0]
            if (startText.text) {
              // Check for checkbox syntax [x] or [ ] at start of text
              if (!checkedConfig) {
                const checkboxRe = /^\[( |x)\]\s*/
                const checkboxMatch = checkboxRe.exec(startText.text)
                if (checkboxMatch) {
                  node.checked = checkboxMatch[1] === 'x'
                  startText.text = startText.text.replace(checkboxRe, '')
                  if (startText.type === 'para') {
                    startText.content = [startText.text]
                  }
                  node.config = node.config || []
                  node.config.push({
                    name: 'checked',
                    value: node.checked,
                    type: 'boolean',
                  })
                }
              }

              let re = /^(\s*#\s*)/
              const match = re.exec(startText.text)
              if (match) {
                startText.text = startText.text.replace(re, '')
                if (startText.type === 'para') {
                  startText.content = [startText.text]
                }
                node.config = node.config || []
                node.config.push({
                  name: 'numbered',
                  value: true,
                  type: 'boolean',
                })
              }
            }
          }
        }
        visit(node.content)
      }
    }
  }
  visit(tree)
  return tree
}
