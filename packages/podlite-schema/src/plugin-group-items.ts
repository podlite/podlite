import makeAttrs from './helpers/config'

// lists nest no deeper than this: deeper trees overflow the stack of the renderers
export const MAX_LIST_LEVEL = 50

export default (opt: { diagnostics?: unknown[] } = {}) =>
  tree => {
    const isNodesEqual = (n1, n2) =>
      // if nodes items
      (n1.name === 'item' || n1.name === 'defn') &&
      n2.name === n1.name &&
      n1['level'] === n2.level &&
      isNumbered(n1) === isNumbered(n2) &&
      isChecked(n1) === isChecked(n2)

    const isNumbered = node => Boolean(makeAttrs(node, {}).exists('numbered'))
    const isChecked = node => node.checked !== undefined

    // the level a list is built at; the level the author wrote stays on the item
    const nestAt = item => Math.min(Number(item.level), MAX_LIST_LEVEL)
    const tooDeep = item => item.name === 'item' && item.type === 'block' && Number(item.level) > MAX_LIST_LEVEL
    const report = item => {
      if (!Array.isArray(opt.diagnostics)) return
      opt.diagnostics.push({
        severity: 'warning',
        code: 'list-too-deep',
        message: `list item at level ${Number(
          item.level,
        )} is deeper than ${MAX_LIST_LEVEL} levels; it is shown at level ${MAX_LIST_LEVEL}`,
        location: item.location,
      })
    }
    // a list is the items of one content with nothing but blank lines between them
    const reportDeepLists = content => {
      let told = false
      content.forEach(node => {
        if (node.type === 'blankline') return
        if (node.name !== 'item' || node.type !== 'block') told = false
        else if (!told && tooDeep(node)) {
          report(node)
          told = true
        }
      })
    }

    // the content of a list is grouped again for its next level and is not told twice
    const group = (a, level = 1, ofList = false) => {
      if (!ofList) reportDeepLists(a)
      const isInListMode = a => {
        return a.length > 0 && a[a.length - 1].type === 'list'
      }
      const getList = a => {
        if (isInListMode(a)) return a[a.length - 1]
      }
      const isInsertableToList = (l, i) =>
        (i.name && i.name === 'item' && i.type && i.type === 'block') || i.type === 'blankline'
      let lastItem = {}

      let result = a.reduce((a, i) => {
        // skip items out of level
        if (i.name === 'item' && i.type === 'block' && nestAt(i) < level) {
          a.push(i)
          return a
        }
        if (
          i.name === 'item' &&
          i.type === 'block' &&
          (!isInListMode(a) ||
            // different type of list and item
            // at the same  level
            // and an item past the limit in a list that already stands at the limit
            ((nestAt(i) === level || (tooDeep(i) && Number(getList(a).level) === MAX_LIST_LEVEL)) &&
              getList(a).list !== (isNumbered(i) ? 'ordered' : isChecked(i) ? 'task' : 'itemized')))
        ) {
          // create empty list
          // list = ['ordered', 'variable', 'itemized']
          a.push({
            type: 'list',
            level: tooDeep(i) ? MAX_LIST_LEVEL : i.level,
            content: [],
            list: isNumbered(i) ? 'ordered' : isChecked(i) ? 'task' : 'itemized',
          })
        }
        // main logic
        if (isInListMode(a) && isInsertableToList(getList(a), i)) {
          // getlist and push item to them
          getList(a).content.push(i)
        } else {
          a.push(i)
        }
        return a
      }, [])
      // convert grouped items into object 'itemlist'
      /**
       * { type = 'list',
       *   ordered = [true, false]
       *   content = [ .... ]
       *   list = ['ordered', 'variable', 'task', 'itemized']
       */
      return result.map(item => {
        // process any item with content ( except formatting codes)
        if (item.content && item.type !== 'fcode') {
          item.content = group(item.content, Number(item.level || 0) + 1, item.type === 'list')
        }
        return item
      })
    }
    const visit = node => {
      if (Array.isArray(node)) {
        node = group(node)
      } else {
        if (node.type === 'block' && node.name !== 'table') {
          node.content = group(node.content)
        }
      }
      return node
    }
    tree = visit(tree)
    return tree
  }
