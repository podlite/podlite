import * as React from 'react'
import {UnControlled as CodeMirror} from 'react-codemirror2'
import {Controlled as CodeMirrorControlled} from 'react-codemirror2'
import {EditorConfiguration} from 'codemirror'
import { useState, useEffect, useRef, useMemo } from 'react'

//@ts-ignore
import {isValidElementType, isElement} from  'react-is'

// import Mousetrap from 'mousetrap'
// ; // global-bind must be import after Mousetrap
// import 'mousetrap-global-bind';
// TODO: use bundler to add into package
// import '../../../node_modules/codemirror/lib/codemirror.css';
import './Editor.css';
import 'codemirror/mode/gfm/gfm';

import path from 'path'


//@ts-ignore
function useDebouncedEffect(fn, deps, time) {
  const dependencies = [...deps, time] 
  useEffect(() => {
    const timeout = setTimeout(fn, time);
    return () => {
      clearTimeout(timeout);
    }
  }, dependencies);
}

/* set window title */ 
// @ts-ignore
// const setWindowTitle = (title: string) => { vmd.setWindowTitle(title) }
export interface ConverterResult  {
     errors?:any,
     result:any
}

let instanceCM = null
type Props={
    content: string,
    onChangeSource:Function,
    sourceType?: 'pod6' | 'md',
    onConvertSource: (source:string)=>ConverterResult,
    onSavePressed?: Function,
    isDarkTheme? : boolean,
    isLineNumbers?: boolean,
    isPreviewModeEnabled? :boolean
    isControlled?:boolean
}

export default ({ onChangeSource = ()=>{}, content, isDarkTheme = false, isLineNumbers = false, isPreviewModeEnabled = false, onConvertSource, onSavePressed = () => { }, sourceType = 'pod6', isControlled=false}: Props) => {
  const [text, updateText] = useState(content)

  const [marks, updateMarks] = useState([])
  const [, updateScrollMap] = useState([])
  
  const [isPreviewMode, setPreviewMode] = useState(isPreviewModeEnabled)

  const [isPreviewScroll, setPreviewScrolling] = useState(false);
  const refValue = useRef(isPreviewScroll);
  const [showTree, setShowTree] = useState(false)

  const [filePath, setFilePath] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileExt, setFileExt] = useState('')
  const [isChanged, setChanged] = useState(false)

  const [fileLoading, setFileLoading] = useState(true)

useEffect(()=>{
updateText(content)
},[content])

 const [result, updateResult] = useState<ConverterResult>() 
  useDebouncedEffect(() => {
    updateResult(onConvertSource(text))
  }, [text], 50)
 
  const inputEl = useRef(null)

// hot keys
  useEffect( () => {
  const saveFileAction  =  () => {
    if (isChanged)  {
        console.warn("Save File")
        onSavePressed(text)

    }
  }
// TODO: remove save keys binds
//   Mousetrap.bindGlobal(['ctrl+s', 'command+s'], saveFileAction)
return () => {
    // Mousetrap.unbind(['ctrl+s', 'command+s'])
  }

})


useEffect(() => {
    refValue.current = isPreviewScroll;
});
var options: EditorConfiguration = {
  lineNumbers: isLineNumbers,
  inputStyle: "contenteditable",
  //@ts-ignore
  spellcheck: true,
  autofocus:true,
  lineWrapping:true,
  viewportMargin:Infinity,
  mode: sourceType !== 'md' ? null : 
                            {
                                name: "gfm",
                                tokenTypeOverrides: {
                                emoji: "emoji"
                                }
                            },
 theme: isDarkTheme ? "duotone-dark" : "default"
};


const previewEl = useRef(null)

useEffect(() => {
 //@ts-ignore
  const newScrollMap = [...document.querySelectorAll('.line-src')]
                  .map(n => {
                              const line = parseInt(n.getAttribute('data-line'),10 )
                              //@ts-ignore
                              const offsetTop = n.offsetTop
                              return { line, offsetTop}
                  })
  //@ts-ignore                      
  updateScrollMap(newScrollMap)
  //@ts-ignore
  const listener = (e) => { 
    if (!isPreviewScroll ) {return}
    let element = e.target
    //@ts-ignore
    const getLine = (offset) => {
      const c = newScrollMap.filter( i => i.offsetTop > offset )
      const lineElement = c.shift() || newScrollMap[ newScrollMap.length - 1 ]
      if (!lineElement)  {
          console.warn(`[podlite-editor] can't get line for offset. Forget add .line-src ?`)
      }
      return lineElement.line
      }
    const line  =  getLine(element.scrollTop)
    if (instanceCM) {
      const t = element.scrollTop === 0 ? 0 : instanceCM.charCoords({line: line, ch: 0}, "local").top;
      instanceCM.scrollTo(null, t);
    }
    return true
  }
  if (previewEl && previewEl.current) {
      //@ts-ignore
       previewEl.current.addEventListener("scroll", listener);
  }
  return () => {
    // @ts-ignore
    previewEl && previewEl.current && previewEl && previewEl.current.removeEventListener("scroll", listener);
  };
},[text,isPreviewScroll])

useEffect(() => {
 //@ts-ignore
 let cm = instanceCM
 if (!cm) {return}
 //@ts-ignore
marks.forEach(marker => marker.clear())
//@ts-ignore
let cmMrks:Array<never> = []
//@ts-ignore
if (result && result.errors ) {

  //@ts-ignore
result.errors.map((loc:any)=>{
  // @ts-ignore
  let from = {line: loc.start.line-1, ch: loc.start.column-1 - (loc.start.offset === loc.end.offset)};
  let to = {line: loc.end.line-1, ch: loc.end.column-1};

  cmMrks.push(
              //@ts-ignore
              cm.markText(
                  from,
                  to, 
                  {
                    className: 'syntax-error',
                    title: ';data.error.message',
                    css: "color : red"
                  }
              )
                  
  )
})
}
updateMarks(cmMrks)

},[text,result])



const previewHtml = <div className={ "Editorright " + (isDarkTheme ? 'dark' : '' )}
                        onMouseEnter={()=>setPreviewScrolling(true)} 
                        onMouseMove={()=>setPreviewScrolling(true)} 
                        ref={previewEl} 
                        >
                     {
                     result ? 
                     isElement(result.result) ? <div className="content">{result.result}</div> : <div 
                     dangerouslySetInnerHTML={{__html: result.result}} 
                     className="content" 
                     ></div>
                     : ''
                        
                        }
                     </div>
//@ts-ignore
const scrollEditorHandler = (editor) => {
if (refValue.current) { return }
let scrollInfo = editor.getScrollInfo();
// get line number of the top line in the page
let lineNumber = editor.lineAtHeight(scrollInfo.top, 'local') + 1;
if (previewEl) {
  const el = previewEl.current
  const elementId = `#line-${lineNumber}`
  const scrollToElement = document.querySelector(elementId)
  if (scrollToElement) {
    //@ts-ignore
    const scrollTo = scrollToElement.offsetTop
    //@ts-ignore
    el.scrollTo({
      top: scrollTo,
      left: 0,
      behavior: 'smooth'
    })
 }
  
}
}
return (
  <div className="EditorApp">
    <div className={ isPreviewModeEnabled ? "layoutPreview": "layout"}>
        <div className="Editorleft" onMouseEnter={()=>setPreviewScrolling(false)}
                               onMouseMove={()=>setPreviewScrolling(false)}
        >
        {isControlled ? 
        <CodeMirrorControlled
        value={content}
        editorDidMount={ editor => { instanceCM = editor } }
        onBeforeChange={(editor, data, value) => {
            setChanged(true); 
            // updateText(value);
            onChangeSource(value)
        }}
        // onChange={(editor, data, value) => {

        // }}
        onScroll={scrollEditorHandler}
        options={options} 
        className="editorApp"
        />
        :
        <CodeMirror 
            value={content}
            editorDidMount={ editor => { instanceCM = editor } }
            onChange = { (editor, data, value) => { 
                setChanged(true); 
                updateText(value);
                onChangeSource(value)
            } }
            onScroll={scrollEditorHandler}
            options={options} 
            className="editorApp"
         />
         }
         </div>
         {previewHtml}
    </div>
  </div>
);
}
