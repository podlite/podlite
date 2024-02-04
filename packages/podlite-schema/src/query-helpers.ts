import { makeTransformer } from './'
import { PodNode } from './types'

type Query = ((par: Object) => Boolean) | any
/**
 * compileQuery - compile a query to a function
    
    Object as a parameter:
    {'name':'head', level:[1,2,3,4]}
    
    const checkObject = compileQuery({name:'head',level:2}, (item)=>item.name === 1);
    
    Function as a parameter:
    (item)=>item.name === 1
    const checkObject2 = compileQuery((i)=>i.name == '1')

    const r = checkObject([{name:'head', level:1},{name:'head', level:2},{name:'head', level:2}, {name:1, level:2}])
 * 
 * @param obj 
 * @returns  function that can be used to filter the objects
 */
export const compileQuery = (...obj: Query[]): ((any) => any) => {
  const queries: Array<(par: Object) => Boolean> = []
  const compiledQueries = obj.map(compileAtomQuery)
  return function OR(par) {
    const source = par instanceof Array ? par : [par]
    const result = []

    source.forEach(item => {
      if (item instanceof Array) {
        result.push(...OR(item))
      } else {
        // obj should accomplished if some queries is true
        if (compiledQueries.some(fn => fn(item).length > 0)) {
          result.push(item)
        }
      }
    })
    return result
  }
}
const compileAtomQuery = (obj: Query): ((any) => any) => {
  const queries: Array<(par: Object) => Boolean> = []
  if (obj instanceof Array) {
    throw new Error('Wrong query parameter [Array], should be [Function] or [Object]')
  } else if (typeof obj === 'function') {
    queries.push(obj)
  } else {
    for (const entry of Object.entries(obj)) {
      const [key, value] = entry
      const checkValue = val => {
        if (value instanceof Array) {
          return value.includes(val)
        } else {
          if (typeof value === 'number') {
            return parseInt(val, 10) === value
          } else {
            return val === value
          }
        }
      }
      const checkKeyfn = (obj: Object) => {
        if (obj.hasOwnProperty(key)) {
          return checkValue(obj[key])
        }
        return false
      }
      queries.push(checkKeyfn)
    }
  }
  return function AND(obj) {
    const source = obj instanceof Array ? obj : [obj]
    const result = []
    source.forEach(item => {
      if (item instanceof Array) {
        result.push(...AND(item))
      }
      // obj should accomplished if all queries to be true
      if (queries.every(fn => fn(item))) {
        result.push(item)
      }
    })
    return result
  }
}
/**
 * Get nodes by queries
 * @param tree
 * @param queries
 * @returns array of matched nodes
 */
export const getFromTree = (tree, ...queries: string[] | any): PodNode[] => {
  if (!tree) {
    return []
  }
  let results = []
  let rules = {}
  const transformer = makeTransformer({
    '*:*': (node, ctx) => {
      results.push(node)
      if ('content' in node) {
        return { node, content: transformer(node.content, { ...ctx }) }
      }
    },
  })
  transformer(tree, {})
  //convert queries
  const queryAtoms = []
  queries.forEach(q => {
    if (typeof q === 'string') {
      const getNameLevel = q.match(/^(?<name>(item|head))(?<level>(\d+)?)$/)
      if (getNameLevel) {
        let { name, level } = getNameLevel.groups
        if (name === 'item' && !level) {
          level = '1'
        }
        const levelNum = level ? parseInt(level, 10) : undefined
        queryAtoms.push({ name, ...(levelNum ? { level: levelNum } : {}) })
      } else {
        queryAtoms.push({ name: q })
      }
    } else {
      queryAtoms.push(q)
    }
  })
  return compileQuery(...queryAtoms)(results)
}
