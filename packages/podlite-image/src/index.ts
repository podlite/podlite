
import {mkBlockImage, mkBlockImageParams, Plugin} from '@podlite/schema'
import makeAttrs from 'pod6/built/helpers/config'

const Image:Plugin = {
    toAst: () => (node, ctx) => {
        if (typeof node !== "string" && 'type' in node && 'content' in node && node.type === 'block') {
            
            const content = node.content[0]
            if (content && typeof content !== "string" && 'location' in node && 'value' in content) {
                // get link and alt text
                const data = content.value
                const altRegexp =  /\s*((?<altText>.+)\s+)?(?<link>[^\s]+)/
                const { altText, link } = (data.match(altRegexp) || {groups:{ alt: undefined, link: undefined }} ).groups 

                const props:mkBlockImageParams = {
                    src:'',
                    location:node.location,
                    margin:node.margin
                }
                const conf = makeAttrs(node, ctx)
                if (conf.exists('caption')) {
                    props.caption = conf.getFirstValue('caption')
                }
                if (conf.exists('id')) {
                    props.id = conf.getFirstValue('id')
                }
                if (link) {
                    // clear all \n or spaces
                    props.src = link.split(/\s+/)[0]
                }
                if (altText) {
                    props.alt = altText
                }
                return mkBlockImage(props)
            }
            return node
        }

     },
   toHtml: subUse({
            // inside head don't wrap into <p>
                ':image' : setFn(( node, ctx ) => {
                        return (writer) => (node)=>{
                            const linkTo = ctx.link
                            if (linkTo) { 
                                writer.writeRaw('<a href="')
                                writer.write(linkTo)
                                writer.writeRaw('">')
                            }
                            writer.writeRaw(`<img src="${node.src}" alt="${node.alt}"/>`)
                            if (linkTo) { 
                                writer.writeRaw('</a>')
                            }
                        }
                    }),
                'caption': wrapContent('<div class="caption">', '</div>'),
            },
            setFn(( node, ctx ) => {
                const {level} = node
                const id = getNodeId(node, ctx)
                const conf = makeAttrs(node, ctx)
                if ( conf.exists('link') ) {
                    ctx.link = conf.getFirstValue('link')
                }
                return wrapContent( `<div class="image_block" ${ id ? ` id="${id}"` : ''}>`, `</div>` )
            })
     ),
}
export default Image




