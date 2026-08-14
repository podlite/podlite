export type Context = {
  config?: any
}
export interface Attr {
  getAllValues: (name: any) => any
  getFirstValue: (name: any) => any
  getMapValue: (name: string) => Record<string, string | number | boolean> | undefined
  asHash: () => {}
  (): {}
  exists(name: string): boolean
}

// A markup code is pre-configured under its name followed by a pair of angles.
// The declaration comes first, so a value written on the code itself is read
// last and wins.
export const codeConfigWithDefaults = (node, ctx: Context = {}) => {
  const declared = ctx.config ? ctx.config[`${node.name}<>`] : undefined
  const own = Array.isArray(node.config) ? node.config : []
  return Array.isArray(declared) ? [...declared, ...own] : own
}

export const makeAttrs = (node, ctx: Context = {}): Attr => {
  const config = node.config instanceof Array ? node.config : []
  // add config's from ctx
  let configured = []
  if (ctx.config && ctx.config.hasOwnProperty(node.name)) {
    configured = ctx.config[node.name]
  }
  let result = {}
  ;[...config, ...configured].map(a => {
    if (!result.hasOwnProperty(a.name)) {
      result[a.name] = []
    }
    if (a.type === 'array') {
      result[a.name].push(...a.value)
    } else {
      result[a.name].push(a.value)
    }
  })
  let resfn = function () {} as Attr
  /**
   * check if prop exists
   *
   *  for example: attrs.exists('caption')
   */
  resfn.exists = name => result.hasOwnProperty(name)

  /**
   * return array for prop
   *
   *  for example: attrs.getAllValues('caption')
   */
  resfn.getAllValues = name => {
    return resfn.exists(name) ? result[name] : []
  }

  /**
   * return first value or undefined if prop don't exists
   *
   *  for example: attrs.exists('caption')
   */
  resfn.getFirstValue = name => {
    return resfn.exists(name) ? resfn.getAllValues(name)[0] : undefined
  }

  /**
   * return first map-typed value (from `:attr{ k=>v, ... }` syntax) or
   * undefined when the attribute is absent or not a map value
   */
  resfn.getMapValue = name => {
    const first = resfn.getFirstValue(name)
    return first && typeof first === 'object' && !Array.isArray(first) ? first : undefined
  }

  /**
   * return key: val
   *
   *  for example: attrs.asHash()
   */
  resfn.asHash = () => result

  return resfn
}
export default makeAttrs
