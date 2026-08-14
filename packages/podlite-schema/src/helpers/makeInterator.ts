function flattenDeep(arr) {
  if (!Array.isArray(arr)) {
    return arr
  }
  return arr.reduce((acc, val) => (Array.isArray(val) ? acc.concat(flattenDeep(val)) : acc.concat(val)), [])
}
function thisFunc(rules) {
  function interator(node, context) {
    if (node == null) {
      return node
    }
    if (node instanceof Array) {
      // filter null and undefined nodes
      return flattenDeep(node.map(item => interator(item, context))).filter(Boolean)
    }
    if ('string' === typeof node) {
      // convert string to lex node with type
      return interator({ type: 'text', value: node }, context)
    }
    // a block is a lexical scope: a =config or =alias written inside it must not
    // reach what follows the block. The context object itself is kept, since
    // rules count cells and mark rows through it
    if (node.type === 'block' && context) {
      const outer = { config: context.config, alias: context.alias }
      const had = { config: context.hasOwnProperty('config'), alias: context.hasOwnProperty('alias') }
      context.config = { ...outer.config }
      context.alias = { ...outer.alias }
      try {
        return dispatch(node, context)
      } finally {
        for (const key of ['config', 'alias']) {
          if (had[key]) context[key] = outer[key]
          else delete context[key]
        }
      }
    }
    return dispatch(node, context)
  }
  function dispatch(node, context) {
    // get first rule for this node
    const reversed = rules.slice()
    reversed.reverse()
    const ruleIndex = reversed.findIndex(rule => rule.isFor(node))
    if (ruleIndex !== -1) {
      // try to find next rule
      const nextRuleSet = reversed.slice(ruleIndex + 1)
      const nextRuleIndex = nextRuleSet.findIndex(rule => rule.isFor(node))
      const defaultFn = (n = node, ctx = context, localInterator = interator) => {
        if (nextRuleIndex !== -1) {
          return nextRuleSet[nextRuleIndex].fn(n, ctx, localInterator, () => {
            /* empty default action */
          })
        }
        return
      }

      if (typeof reversed[ruleIndex].fn !== 'function') {
        console.warn('[podlite] bad fn for ' + JSON.stringify(node, null, 2))
      }
      return reversed[ruleIndex].fn(node, context, interator, defaultFn)
    } else {
      // not found rule
      const newNode = { ...node }
      if (newNode.hasOwnProperty('content')) {
        return interator(newNode.content, context)
      }
    }
  }
  interator.rules = rules
  return interator
}
export default thisFunc
