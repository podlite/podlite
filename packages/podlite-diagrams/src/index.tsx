import React from 'react'
import {useEffect, useRef} from 'react'
import mermaid from 'mermaid';
let i = 0;
export const Mermaid = ({ chart }: {chart:string})=>{
    const inputEl = useRef(null);
          // Mermaid initilize its config
    // mermaid.initialize({...DEFAULT_CONFIG, ...config})
    const config = {
        // startOnLoad: true,
        // theme: "default",
        securityLevel: "loose",
        startOnLoad: false 
    }
    if ( inputEl ) {
    mermaid.initialize(config)
    //@ts-ignore
    mermaid.init( inputEl)
    }
    // useEffect(() => {
    //     mermaid.contentLoaded()
    //   }, [config])

    useEffect(()=>{
        var insertSvg = function(svgCode:any){
            // if ( inputEl.current != null ) {
                // console.log("memrmr")
                if (!inputEl.current) {console.log("ok")}
                //@ts-ignore
                inputEl.current!.innerHTML = svgCode;
            // }
        };
  
        try {
            mermaid.render('graph-div' + i++, chart, insertSvg)
            // mermaid.render(id, element.textContent.trim(), (svg, bind) => {element.innerHTML = svg;}, element);
        }  catch (e) {
            console.log({e});
          }
        // mermaid.render('graph-div', chart, ()=>{})
    }, [chart])
    return <div className="mermaid1" ref={inputEl}/>
}


