import React from 'react'
import {useEffect, useRef} from 'react'
import {Plugin, Location} from '@podlite/schema'
import mermaid from 'mermaid';
let i = 0;
const Diagram = ({ chart , isError }: {chart:string, isError:any})=>{
    const inputEl = useRef(null);
    const config = {
        securityLevel: "loose",
        startOnLoad: false 
    }

    useEffect(()=>{
        var insertSvg = function(svgCode:any){
                inputEl.current!.innerHTML = svgCode;
        };
        if(isError) {
            console.log('error')
            return
        }
        try {
            mermaid.initialize(config)
            mermaid.init(undefined,  inputEl.current)
            mermaid.render('graph-div' + i++, chart, insertSvg)
        }  catch (e) {
            console.log({e});
          }
    }, [chart])

    return <div className={ `mermaid${ isError ? ' error' : ''}` } ref={inputEl}/>
}

export const plugin:Plugin = {
    toAst: (writer) => (node) => {
        if (typeof node !== "string" && 'type' in node && 'content' in node && node.type === 'block') {
        const content = node.content[0]
        if (typeof content !== "string" && 'location' in node && 'value' in content) {
            // get link and alt text
            const data = content.value
             try {
             mermaid.parse(data)
            } catch (err) {
                // calculate line in relation to node
                const convert_line_to_absolute = (line:number, location:Location):Location => {
                    const lineoffset=  line + location.start.line + 1
                    return { "start": {
                        "offset": 0,
                        "line": lineoffset,
                        "column": 1
                      },
                      "end": {
                        "offset": 9,
                        "line": lineoffset,
                        "column": 2
                      }
                    }
                }

                node.custom = { ...err, location: convert_line_to_absolute( err['hash']['line'], node.location) }
                writer.emit("errors", node.location )
            }
            return node
        }
        }

     },
}
export default Diagram


