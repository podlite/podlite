
import {mkBlockImage, mkBlockImageParams, Plugin} from '@podlite/schema'

const Image:Plugin = {
    toAst: () => (node) => {
        if (typeof node !== "string" && 'type' in node && 'content' in node && node.type === 'block') {
        const content = node.content[0]
        if (typeof content !== "string" && 'location' in node && 'value' in content) {
            // get link and alt text
            const data = content.value
            const altRegexp =  /\s*\[([^\[\]]*)\]\s*/
            const altText = (data.match(altRegexp) || [,''])[1];
            const link = altText ? data.replace(altRegexp, '') : data
            const props:mkBlockImageParams = {
                src:'',
                location:node.location,
                margin:node.margin
            }
            if (link) {
                props.src = link
            }
            if (altText) {
                props.alt = altText
            }
            return mkBlockImage(props)
        }
        }

     },
   
}
export default Image




