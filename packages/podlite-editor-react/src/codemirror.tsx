import { Annotation, EditorState, StateEffect, type Extension } from '@codemirror/state'
import { EditorView, keymap, type ViewUpdate } from '@codemirror/view'
import { indentWithTab as indentWithTabKey } from '@codemirror/commands'
import { basicSetup as basicSetupExtension, type BasicSetupOptions } from '@uiw/codemirror-extensions-basic-setup'
import * as React from 'react'

// Marks a replacement this component made, so the change listener can tell it
// from something a person typed and not report it back to the caller
const Ours = Annotation.define<boolean>()

export type CodeMirrorProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> & {
  value?: string
  extensions?: Extension[]
  /** An extension. The names 'light', 'dark' and 'none' are still accepted so that
   * older callers do not crash, but no named theme is applied any more */
  theme?: 'light' | 'dark' | 'none' | Extension
  /** Accepted and not acted on. They had an implementation in the package this
   * replaced; nothing here uses them, and they must not reach the element */
  placeholder?: unknown
  selection?: unknown
  initialState?: unknown
  minHeight?: string
  maxHeight?: string
  width?: string
  minWidth?: string
  maxWidth?: string
  onStatistics?: unknown
  root?: unknown
  height?: string
  autoFocus?: boolean
  indentWithTab?: boolean
  basicSetup?: boolean | BasicSetupOptions
  editable?: boolean
  readOnly?: boolean
  onChange?: (value: string, update: ViewUpdate) => void
  onUpdate?: (update: ViewUpdate) => void
  /** Called once the editor exists. A parent cannot learn this any other way: the
   * view is state in here, so creating it re-renders this component and not them */
  onCreateEditor?: (view: EditorView, state: EditorState) => void
}

export type CodeMirrorRef = {
  editor: HTMLDivElement | null
  state?: EditorState
  view?: EditorView
}

const EMPTY: Extension[] = []

// Accepted so that a caller written against the package this replaced does not
// crash, but nothing here acts on them. Silence would be worse than a word: the
// type says they are taken, and only this tells anyone they are not
const INERT = [
  'placeholder',
  'selection',
  'initialState',
  'onStatistics',
  'root',
  'minHeight',
  'maxHeight',
  'width',
  'minWidth',
  'maxWidth',
] as const

const warnOnce = new Set<string>()
const warnAboutInert = (props: CodeMirrorProps): void => {
  if (process.env.NODE_ENV === 'production') return
  for (const name of INERT) {
    if (props[name] === undefined || warnOnce.has(name)) continue
    warnOnce.add(name)
    console.warn(`[podlite] ${name} is accepted by the editor and does nothing`)
  }
}

const PodliteCodeMirror = React.forwardRef<CodeMirrorRef, CodeMirrorProps>((props, ref) => {
  const {
    value = '',
    extensions = EMPTY,
    theme,
    height,
    autoFocus,
    indentWithTab = true,
    basicSetup = true,
    editable = true,
    readOnly = false,
    onChange,
    onUpdate,
    onCreateEditor,
    className,
    placeholder: _placeholder,
    selection: _selection,
    initialState: _initialState,
    minHeight: _minHeight,
    maxHeight: _maxHeight,
    width: _width,
    minWidth: _minWidth,
    maxWidth: _maxWidth,
    onStatistics: _onStatistics,
    root: _root,
    ...rest
  } = props

  React.useEffect(() => warnAboutInert(props), [props])

  const container = React.useRef<HTMLDivElement>(null)
  const [view, setView] = React.useState<EditorView>()

  // Kept in refs so a new callback on every render does not reconfigure the editor.
  // Written at commit, never during render: a render that is thrown away must not
  // hand the live editor callbacks belonging to a document nobody is looking at
  const onChangeRef = React.useRef(onChange)
  const onUpdateRef = React.useRef(onUpdate)
  const onCreateRef = React.useRef(onCreateEditor)
  React.useLayoutEffect(() => {
    onChangeRef.current = onChange
    onUpdateRef.current = onUpdate
    onCreateRef.current = onCreateEditor
  })

  const listener = React.useMemo(
    () =>
      EditorView.updateListener.of((update: ViewUpdate) => {
        if (update.docChanged && !update.transactions.some(tr => tr.annotation(Ours))) {
          onChangeRef.current?.(update.state.doc.toString(), update)
        }
        onUpdateRef.current?.(update)
      }),
    [],
  )

  const configured = React.useMemo(() => {
    const set: Extension[] = [listener]
    if (basicSetup) set.push(typeof basicSetup === 'boolean' ? basicSetupExtension() : basicSetupExtension(basicSetup))
    if (indentWithTab) set.push(keymap.of([indentWithTabKey]))
    if (height !== undefined)
      set.push(EditorView.theme({ '&': { height }, '& .cm-scroller': { height: '100% !important' } }))
    if (theme && typeof theme !== 'string') set.push(theme)
    if (!editable) set.push(EditorView.editable.of(false))
    if (readOnly) set.push(EditorState.readOnly.of(true))
    return set.concat(extensions)
  }, [listener, basicSetup, indentWithTab, height, theme, editable, readOnly, extensions])

  // Step 1 of the sequence: the editor exists before anything else runs
  React.useEffect(() => {
    if (!container.current) return
    const created = new EditorView({
      state: EditorState.create({ doc: value, extensions: configured }),
      parent: container.current,
    })
    installed.current = configured
    setView(created)
    onCreateRef.current?.(created, created.state)
    return () => {
      created.destroy()
      setView(undefined)
    }
    // The document and the extension set are carried in by their own effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reconfiguring the moment the editor appears would throw away anything a caller
  // added from onCreateEditor. What is installed is whatever the constructor was
  // handed - not whatever this effect happens to see, which can already be newer
  // if the callback moved a prop
  const installed = React.useRef<Extension[]>()
  React.useEffect(() => {
    if (!view || installed.current === configured) return
    installed.current = configured
    view.dispatch({ effects: StateEffect.reconfigure.of(configured) })
  }, [view, configured])

  // Step 1 of the sequence, the part that matters for a file switch: the text is
  // in place before the parent's own effects run, because a child's effects run
  // first. Nothing is deferred, so nothing can arrive late
  React.useEffect(() => {
    if (!view) return
    const current = view.state.doc.toString()
    if (value === current) return
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
      annotations: [Ours.of(true)],
    })
  }, [view, value])

  React.useEffect(() => {
    if (autoFocus && view) view.focus()
  }, [autoFocus, view])

  React.useImperativeHandle(ref, () => ({ editor: container.current, state: view?.state, view }), [view])

  const classes = className ? `cm-theme ${className}` : 'cm-theme'
  return <div ref={container} className={classes} {...rest} />
})

PodliteCodeMirror.displayName = 'PodliteCodeMirror'

export default PodliteCodeMirror
