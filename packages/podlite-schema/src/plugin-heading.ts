import { applyNumberedShorthand } from './helpers/numberedShorthand'

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
          if (node.content[0]) applyNumberedShorthand(node)
        }
        visit(node.content)
      }
    }
  }
  visit(tree)
  return tree
}
