// At this point the leading content element is still an unparsed text node;
// formatting codes are built from its value further down the pipeline. Cut the
// marker out of that value and leave the node in place — replacing the array
// with a plain string ends the chain early and drops every L<>, C<> and B< >
// written on the same line.
const stripMarker = (para, re) => {
  para.text = para.text.replace(re, '')
  if (para.type !== 'para') return
  if (!Array.isArray(para.content)) {
    para.content = [para.text]
    return
  }
  const first = para.content[0]
  if (typeof first === 'string') {
    para.content[0] = first.replace(re, '')
  } else if (first && typeof first.value === 'string') {
    first.value = first.value.replace(re, '')
  }
}

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
                  stripMarker(startText, checkboxRe)
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
                stripMarker(startText, re)
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
