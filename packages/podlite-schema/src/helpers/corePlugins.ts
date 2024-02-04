import { content } from "..";

export const core = {
    ':image':{
        toHtml:(writer)=>(node)=>{
            if (typeof node !== "string" && 'type' in node && node.type === 'image')  {
            writer.writeRaw(`<img`);
            writer.writeRaw(` src="${node.src}"`)
            if (node.alt) {
                writer.writeRaw(` alt="${node.alt}"`)
            }
            writer.writeRaw(`/>`)
            }
        }
    },
    'image': { 
        toHtml: content 
    },
    'root' : {
        toHtml: content
    }
}
export default core