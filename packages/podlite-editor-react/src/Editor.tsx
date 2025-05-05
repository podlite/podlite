import React, { useState, useRef, useImperativeHandle, useEffect, useCallback } from 'react'
import CodeMirror, { ViewUpdate, ReactCodeMirrorProps, ReactCodeMirrorRef } from '@uiw/react-codemirror'
import Podlite from '@podlite/to-jsx'
import { podlite as podlite_core } from 'podlite'
import * as events from '@uiw/codemirror-extensions-events'
import { podliteLang } from './podlite'
import { defaultTheme } from './theme'
import { EditorView, keymap } from '@codemirror/view'
import { defaultKeymap } from '@codemirror/commands'
import { isElement } from 'react-is'
import { Node } from '@podlite/schema'
import { autocompletion, snippet } from '@codemirror/autocomplete'
import dictionary from './dict'

function useDebouncedEffect(fn, deps, time) {
  const dependencies = [...deps, time]
  useEffect(() => {
    const timeout = setTimeout(fn, time)
    return () => {
      clearTimeout(timeout)
    }
  }, dependencies)
}

/* set window title */
export interface ConverterResult {
  errors?: any
  result: JSX.Element | string //React.ReactNode
}

export interface IPodliteEditor extends ReactCodeMirrorProps {
  value?: string
  /** Preview expanded width @default `50%` */
  previewWidth?: string
  /** Whether to enable preview function @default `true` */
  enablePreview?: boolean
  /** Whether to enable scrolling */
  enableScroll?: boolean
  /** Edit mode and preview mode switching event */
  onPreviewMode?: (isHide: boolean) => void
  /** Setfull screen */
  isFullscreen?: boolean
  onChange?: (value: string, viewUpdate: ViewUpdate) => void
  makePreviewComponent?: (source: string) => ConverterResult
}

export interface PodliteEditorRef {
  editor: React.RefObject<ReactCodeMirrorRef>
  preview: React.RefObject<HTMLDivElement> | null
}
const PodliteEditor: PodliteEditorComponent = React.forwardRef<PodliteEditorRef, IPodliteEditor>(
  PodliteEditorInternal,
) as unknown as PodliteEditorComponent

type PodliteEditorComponent = React.FC<React.PropsWithRef<IPodliteEditor>>

export default PodliteEditor

function PodliteEditorInternal(
  props: IPodliteEditor,
  ref?: ((instance: PodliteEditorRef) => void) | React.RefObject<PodliteEditorRef> | null,
) {
  const isBrowser = typeof window !== 'undefined'
  if (!isBrowser) return null
  const {
    onChange,
    enableScroll = true,
    enablePreview = true,
    extensions = [],
    previewWidth = '50%',
    onPreviewMode,
    isFullscreen,
    makePreviewComponent,
    ...codemirrorProps
  } = props
  const [value, setValue] = useState(props.value || '')
  const [text1, setText] = useState(props.value || '')
  const codeMirror = useRef<ReactCodeMirrorRef>(null)
  const container = useRef<HTMLDivElement>(null)
  const containerEditor = useRef<HTMLDivElement>(null)
  const preview = useRef<HTMLDivElement>(null)
  const active = useRef<'editor' | 'preview'>('editor')
  const topLine = useRef<number>(1)

  const $viewHeight = useRef<number>(0)
  useImperativeHandle(
    ref,
    () => ({
      editor: codeMirror,
      preview: preview,
    }),
    [codeMirror],
  )

  const height = isFullscreen
    ? '100%'
    : typeof codemirrorProps.height === 'number'
    ? `${codemirrorProps.height}px`
    : codemirrorProps.height

  const preValue = props.value

  useEffect(() => setValue(preValue ?? ''), [preValue])
  useEffect(() => setText(preValue ?? ''), [preValue])
  const fullRef = useRef(isFullscreen)
  useEffect(() => {
    fullRef.current = isFullscreen
  }, [isFullscreen])

  const onAnyUpdateEditorSize = () => {
    const clientHeight = containerEditor?.current?.parentElement?.clientHeight
    if (clientHeight && codeMirror?.current?.view?.dom) {
      if (fullRef.current) {
        codeMirror.current.view.dom.style.height = `${clientHeight}px`
        $viewHeight.current = clientHeight
      } else {
        codeMirror.current.view.dom.removeAttribute('style')
      }
    }
  }
  type ScrollMap = { line: number; offsetTop: number }
  const getScrollMap = (el: HTMLDivElement): ScrollMap[] => {
    const res = [...preview.current.querySelectorAll('.line-src')].map(n => {
      const line = parseInt(n.getAttribute('data-line'), 10)
      const offsetTop = (n as HTMLDivElement).offsetTop
      return { line, offsetTop }
    })
    if (res.length === 0) {
      console.warn(`[podlite-editor] can't get line for offset. Forget add .line-src ?`)
    }
    return res
  }
  const getNearestMapForLine = (scrollMap: ScrollMap[], line): ScrollMap => {
    const res = scrollMap.findIndex(i => i.line > line)
    if (res === -1) {
      return scrollMap[scrollMap.length - 1]
    }
    return scrollMap[res]
  }

  const getNearestMapForLineReverse = (scrollMap: ScrollMap[], line): ScrollMap => {
    const res = scrollMap.findIndex(i => i.line > line)
    if (res === -1) {
      return scrollMap[0]
    }
    return scrollMap[res]
  }
  const getNearestMapForOffset = (scrollMap: ScrollMap[], offset): ScrollMap => {
    const res = scrollMap.findIndex(i => i.offsetTop > offset)
    if (res === -1) {
      return scrollMap[scrollMap.length - 1]
    }
    return scrollMap[res]
  }

  // we tray to get the line number of the preview

  useEffect(() => {
    if (!preview.current) return
    const listener = e => {
      if (!enableScroll) return

      if (active.current === 'editor') return
      let element = e.target
      const line = getNearestMapForOffset(getScrollMap(preview.current), element.scrollTop).line

      // get pos from
      const pos = codeMirror.current.view.state.doc.line(line).from + 0

      // Set the cursor selection to the position
      codeMirror.current.view.dispatch({
        selection: { anchor: pos },
        scrollIntoView: true,
      })

      const linePos = codeMirror.current.view.coordsAtPos(codeMirror.current.view.state.doc.line(line).from)
      // Calculate to try to center the line in the editor
      if (linePos) {
        const editorRect = codeMirror.current.view.dom.getBoundingClientRect()
        const offset = linePos.top - editorRect.top - editorRect.height / 4 // 2 for middle of screen
        codeMirror.current.view.scrollDOM.scrollTop += offset
      }
      return true
    }
    preview?.current?.addEventListener('scroll', listener)

    return () => {
      preview?.current?.removeEventListener('scroll', listener)
    }
  }, [preview, enableScroll, enablePreview, value])

  const previewScrollHandle = useCallback(
    (event: Event) => {
      if (!enableScroll) return
      onAnyUpdateEditorSize()
      if (codeMirror?.current?.view) {
        const rect = codeMirror.current.view.dom.getBoundingClientRect()
        const topVisibleLineBlock = codeMirror.current.view.lineBlockAtHeight(
          rect.top - codeMirror.current.view.documentTop,
        )

        const tLine = codeMirror.current.view.state.doc.lineAt(topVisibleLineBlock.from).number
        // set current editor visible top line
        topLine.current = tLine
      }

      if (active.current === 'editor' && preview.current) {
        if (preview) {
          let scrollToElement = preview.current.querySelector(`#line-${topLine.current}`) as HTMLDivElement
          if (!scrollToElement) {
            const map = getNearestMapForLineReverse(getScrollMap(preview.current), topLine.current)
            scrollToElement = preview.current.querySelector(`#line-${map?.line || 1}`) as HTMLDivElement
          }
          if (scrollToElement) {
            preview.current.scrollTo({
              top: scrollToElement.offsetTop,
              left: 0,
              behavior: 'auto',
              //   behavior: 'smooth',
            })
          } else {
            console.log('scrollToElement not found' + `#line-${topLine.current}`)
          }
        }
      }
    },
    [enableScroll],
  )
  const mouseoverHandle = () => {
    active.current = 'preview'
    onAnyUpdateEditorSize()
  }
  const mouseleaveHandle = () => {
    active.current = 'editor'
    onAnyUpdateEditorSize()
  }
  useEffect(() => {
    const $preview = preview.current
    if ($preview && enableScroll) {
      $preview.addEventListener('mouseover', mouseoverHandle, false)
      $preview.addEventListener('mouseleave', mouseleaveHandle, false)
      $preview.addEventListener('scroll', previewScrollHandle, false)
    }
    return () => {
      if ($preview && enableScroll) {
        $preview.removeEventListener('mouseover', mouseoverHandle)
        $preview.removeEventListener('mouseleave', mouseoverHandle)
        $preview.removeEventListener('scroll', previewScrollHandle, false)
      }
    }
  }, [preview, enableScroll, previewScrollHandle, enablePreview])

  const scrollExtensions = events.scroll({
    scroll: previewScrollHandle,
  })
  // Create custom keymap that prevents the toggle comment shortcut
  const preventToggleComment = keymap.of([
    {
      key: 'Ctrl-/',
      run: () => true, // Return true to indicate key was handled
      preventDefault: true,
    },
    {
      key: 'Cmd-/',
      run: () => true, // Return true to indicate key was handled
      preventDefault: false,
    },
    ...defaultKeymap,
  ])

  let extensionsData: IPodliteEditor['extensions'] = [podliteLang(), EditorView.lineWrapping, preventToggleComment]
  if (enableScroll) {
    extensionsData.push(scrollExtensions)
  }
  const makeApply = (text: string) => (editor, completion, from, to) => {
    return snippet(text)(editor, completion, from - 1, to)
  }

  type Dict = {
    displayText: string
    text: string
    lang?: 'pod6' | 'md'
  }

  const langDict: Dict[] = dictionary.filter(({ lang = 'pod6' }) => lang === 'pod6')
  const completions = langDict.map(({ displayText, text }) => {
    function cleanBraces(text: string): string {
      return text.replace(/\#\{[^\}]*\}/g, '')
    }

    return {
      label: displayText,
      type: 'keyword',
      apply: makeApply(text),
      info: cleanBraces(text),
    }
  })
  function myCompletions(context) {
    let before = context.matchBefore(/^\s*=\w*/)
    console.log({ before })
    // If completion wasn't explicitly started and there
    // is no word before the cursor, don't open completions.
    if (!context.explicit && !before) return null
    return {
      from: before ? before.from + before.text.indexOf('=') + 1 : context.pos,
      options: completions,
      validFor: /^=\w*$/,
    }
  }
  extensionsData.push(autocompletion({ override: [myCompletions] }))

  useDebouncedEffect(
    () => {
      setValue(text1)
    },
    [text1],
    50,
  )

  useDebouncedEffect(
    () => {
      if (preview.current) {
        const map = getNearestMapForLine(getScrollMap(preview.current), topLine.current)
        const scrollToElement = preview.current.querySelector(`#line-${map?.line || 1}`) as HTMLDivElement
        if (scrollToElement) {
          preview.current.scrollTo({
            top: scrollToElement.offsetTop,
            left: 0,
            behavior: 'auto',
          })
        } else {
          console.log('scrollToElement not found' + `#line-${map?.line || 1}`)
        }
      }
    },
    [enablePreview, previewWidth],
    1,
  )

  const handleChange = (value: string, viewUpdate: ViewUpdate) => {
    setText(value)
    onChange && onChange(value, viewUpdate)
  }

  useEffect(() => {
    if (preview.current) {
      const $preview = preview.current
      if (preview) {
        $preview.style.borderBottomRightRadius = '3px'
      }
      //@ts-ignore
      if ($preview && (previewWidth !== '0' || previewWidth !== '0%')) {
        $preview.style.width = previewWidth
        $preview.style.overflow = 'auto'
        if (previewWidth !== '100%') {
          $preview.style.borderLeft = '1px solid var(--color-border-muted)'
        }
        $preview.style.padding = '20px'
        if (containerEditor.current) {
          if (previewWidth == '100%') {
            containerEditor.current.style.width = '100%'
            containerEditor.current.style.visibility = 'hidden'
            containerEditor.current.style.opacity = '0'
          } else {
            containerEditor.current.style.width = previewWidth !== '100%' ? `calc(100% - ${previewWidth})` : '0%'
            containerEditor.current.style.visibility = 'visible'
            containerEditor.current.style.opacity = '1'
          }
        }
      } else if ($preview) {
        $preview.style.width = '0%'
        $preview.style.overflow = 'hidden'
        $preview.style.borderLeft = '0px'
        $preview.style.padding = '0'
        if (containerEditor.current) {
          containerEditor.current.style.width = '100%'
          containerEditor.current.style.visibility = 'visible'
          containerEditor.current.style.opacity = '1'
        }
      }
    } else {
      if (containerEditor.current) {
        containerEditor.current.style.width = '100%'
        containerEditor.current.style.visibility = 'visible'
        containerEditor.current.style.opacity = '1'
        if (codeMirror?.current?.view) {
          console.log('set focus')
          codeMirror.current.view.focus()
        }
      }
    }
  }, [containerEditor, preview, previewWidth])

  const full_preview = previewWidth === '100%'

  const $height = useRef<number>(0)
  const entriesHandle: ResizeObserverCallback = (entries: ResizeObserverEntry[]) => {
    for (const entry of entries) {
      if (codeMirror?.current?.view?.dom) {
        if (fullRef.current) {
          codeMirror.current.view.dom.style.height = `${entry.target.clientHeight}px`
          $viewHeight.current = entry.target.clientHeight
        } else {
          codeMirror.current.view.dom.removeAttribute('style')
        }
      }
    }
    robserver?.current?.disconnect()
    if (robserver !== null) {
      robserver.current = undefined
    }
  }

  const robserver = useRef<ResizeObserver | undefined>(new ResizeObserver(entriesHandle))

  useEffect(() => {
    if (!robserver.current) {
      robserver.current = new ResizeObserver(entriesHandle)
    }
    if (containerEditor?.current?.parentElement && robserver.current) {
      const parentElement = containerEditor.current.parentElement
      robserver.current.observe(parentElement)
    }
    return () => {
      if (robserver.current) {
        robserver.current.disconnect()
        robserver.current = undefined
      }
    }
  }, [containerEditor, entriesHandle, codeMirror, isFullscreen, robserver])

  useEffect(() => {
    if (!document) return
    const containerEl = container.current
    document.body.style.overflow = isFullscreen ? 'hidden' : 'initial'
    isFullscreen
      ? document.body.classList.add(`podlite-editor-fullscreen`)
      : document.body.classList.remove(`podlite-editor-fullscreen`)

    if (containerEl && isFullscreen) {
      containerEl.style.zIndex = '999'
      containerEl.style.position = 'fixed'
      containerEl.style.top = '0px'
      containerEl.style.bottom = '0px'
      containerEl.style.left = '0px'
      containerEl.style.right = '0px'
    }
  }, [isFullscreen, container])

  const clsPreview = 'podlite-editor-preview Editorright layoutPreview'
  const cls = ['podlite-editor', 'podlite-var'].filter(Boolean).join(' ')

  const getTree = (value: string) => {
    let podlite = podlite_core({ importPlugins: true })
    let tree = podlite.parse(value)
    const asAst = podlite.toAstResult(tree)
    return asAst
  }

  // wrap all elements and add line link info
  const wrapFunction = (node: any, children) => {
    if (node?.location?.start?.line) {
      const line = node.location.start.line

      return (
        <div key={line} className="line-src" data-line={line} id={`line-${line}`}>
          {children}
        </div>
      )
    } else {
      return children
    }
  }

  const wrapFunctionNoLines = (node: Node, children) => children

  const defaultPreview = (source: string) => {
    const result = <Podlite wrapElement={wrapFunction} tree={getTree(source)} />
    return { result }
  }

  const previewContent = () => {
    if (!enablePreview) return null
    const preview = makePreviewComponent ? makePreviewComponent(value) : defaultPreview(value)
    if (preview) {
      return isElement(preview.result) ? (
        <div className="content">{preview.result}</div>
      ) : (
        <div dangerouslySetInnerHTML={{ __html: preview.result as string }} className="content"></div>
      )
    }
    return null
  }
  const conentView = (
    <div className={`podlite-editor-content`} style={{ height: codemirrorProps?.height }}>
      <div className={`podlite-editor-content-editor`} ref={containerEditor}>
        <CodeMirror
          theme={defaultTheme}
          {...{ ...codemirrorProps, ...{ basicSetup: { defaultKeymap: false } } }}
          className={`podlite-editor-inner`}
          extensions={extensionsData}
          height={height}
          ref={codeMirror}
          onChange={handleChange}
        />
      </div>
      {enablePreview && (
        <div className={clsPreview} style={{ overflow: full_preview ? 'visible' : 'hidden' }} ref={preview}>
          {previewContent()}
        </div>
      )}
    </div>
  )

  return (
    <div>
      <div className={cls} ref={container}>
        {conentView}
      </div>
      <div style={{ minWidth: '80rem', display: 'flex' }}> </div>
    </div>
  )
}
