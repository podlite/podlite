
import {getNodeId, mkCaption, mkImage, Plugin, PodNode} from '@podlite/schema'
import makeAttrs from 'pod6/built/helpers/config'
import { setFn, subUse, wrapContent } from 'pod6/built/helpers/handlers'
const Image1:Plugin = {}
const Image:Plugin = {
    toAst: (_, processor) => (node, ctx) => {
        if (typeof node !== "string" && 'type' in node && 'content' in node && node.type === 'block') {
            
            const content = node.content[0]
            if (content && typeof content !== "string" && 'location' in node && 'value' in content) {
                // get src and alt text
                const lines = content.value.split('\n')
                const [data, ...caption ] = lines
                const captionText = caption.join('\n')
                const altRegexp = /\s*((?<altText>.+)\s+)?(?<src>[^\s]+)/
                const { altText, src } = (data.match(altRegexp) || {groups:{ altText: undefined, src: undefined }} ).groups 
                const conf = makeAttrs(node, ctx)
                // make  inline image
                const imageSrc = conf.exists('src') ? conf.getFirstValue('src') : src
                const imageAlt = conf.exists('alt') ? conf.getFirstValue('alt') : altText
                const resultContent: Array<PodNode>= [ mkImage(imageSrc, imageAlt)]
                // make caption
                const captionContent = conf.exists('caption') ? conf.getFirstValue('caption') : captionText
                if ( captionContent ) {
                    resultContent.push( mkCaption(processor(captionContent)) )
                }

                return { ...node, content:resultContent ,/* content_: node.content */}
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




