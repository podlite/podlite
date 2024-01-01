export type Context = {
    config?:any,
}
export interface Attr  {
    getAllValues: (name: any) => any
    getFirstValue: (name: any) => any
    asHash: () => {}
    (): {},
    exists(name:string): boolean,
}

export const makeAttrs  = ( node, ctx:Context = {} ):Attr => {
    const config = node.config instanceof Array ? node.config : []
    // add config's from ctx
    let configured = []
    if ( ctx.config && ctx.config.hasOwnProperty(node.name) ) {
        configured = ctx.config[node.name]
    }
    let result = {};
    [ ...config, ...configured ].map(a => {
        if ( !result.hasOwnProperty(a.name) ) {
            result[a.name] = []
        }
        if (a.type === 'array') {
            result[a.name].push(...a.value)
        } else {
            result[a.name].push(a.value)
        }
    })
    let resfn = function () {} as Attr;
    /**
     * check if prop exists
     * 
     *  for example: attrs.exists('caption')
     */
    resfn.exists = (name) => result.hasOwnProperty(name)

    /**
     * return array for prop
     * 
     *  for example: attrs.getAllValues('caption')
     */
    resfn.getAllValues = (name) => { return resfn.exists(name) ? result[name] : [] }

    /**
     * return first value or undefined if prop don't exists
     * 
     *  for example: attrs.exists('caption')
     */
    resfn.getFirstValue = (name) => { return resfn.exists(name) ? resfn.getAllValues(name)[0] : undefined }

    /**
     * return key: val
     * 
     *  for example: attrs.asHash()
     */            
    resfn.asHash = () => result
    
    return resfn
}
export default makeAttrs