
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
   
}
export default Image




