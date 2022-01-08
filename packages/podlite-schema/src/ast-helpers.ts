import makeAttrs from 'pod6/built/helpers/config'

export const getNodeId = (node, ctx )=>{
    const conf = makeAttrs(node, ctx)
    if ( conf.exists('id') ) {
        return  conf.getFirstValue('id')
    }
    return node.id
}