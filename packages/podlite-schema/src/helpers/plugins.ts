import { Plugins } from ".."

export const toAnyRules =(method, allplugins:Plugins[])=>{ 
    // make uniq plugins
    const resultMap:Plugins = allplugins.reverse().reduce((result:Plugins, plugins:Plugins)=>{
        for ( const plugin of Object.entries(plugins) ) {
            const [ key, val ] = plugin
            if (!( key in result ) ) {
                result[key] = val 
            }
        }
        return result
    },<Plugins>{})

    let result = {}
    // prepare plugins for export <method>
    for ( const plugin of Object.entries(resultMap) ) { 
        const [ key, val = {} ] = plugin
        //@ts-ignore
        if ( method in val ) {
            result[key] = val[method]
        }
    }
    return result
}