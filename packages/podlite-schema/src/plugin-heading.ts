export default () => tree => {
  const visit = node => {
    if (Array.isArray(node)) {
      node.forEach(i => {
        visit(i)
      })
    } else {
      if (node && node.type === 'block') {
        const matchHead = /^head(\d+)?/.exec(node.name)
        if (matchHead) {
          node.name = 'head'
          node.level = matchHead[1] || 1
          if (node.content[0]) {
            const startText = node.content[0]
            if (startText.text) {
              let re = /(\s*#\s*)/
              const match = re.exec(startText.text)
              if (match) {
                startText.text = startText.text.replace(re, '')
                node.config = { ...node.config, ...{ numbered: true } }
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
