import { EditorView } from '@codemirror/view'
import {
  extractImagesFromDataTransfer,
  SaveAssetCallback,
  SaveAssetSource,
  SUPPORTED_PASTE_MIME,
  SUPPORTED_DROP_MIME,
} from './imagePaste'

function insertPicture(view: EditorView, path: string): void {
  const pos = view.state.selection.main.head
  const doc = view.state.doc
  const before = pos > 0 ? doc.sliceString(pos - 1, pos) : '\n'
  const after = pos < doc.length ? doc.sliceString(pos, pos + 1) : '\n'
  const leading = before === '\n' ? '' : '\n'
  const trailing = after === '\n' ? '\n' : '\n\n'
  const insert = `${leading}=picture ${path}${trailing}`
  view.dispatch({
    changes: { from: pos, to: pos, insert },
    selection: { anchor: pos + insert.length },
    scrollIntoView: true,
    userEvent: 'input',
  })
}

export function createImagePasteDropHandler(getSave: () => SaveAssetCallback | undefined) {
  const handleFiles = (view: EditorView, files: File[], source: SaveAssetSource): void => {
    const save = getSave()
    if (!save || files.length === 0) return
    ;(async () => {
      for (const file of files) {
        const path = await save(file, source)
        if (path) insertPicture(view, path)
      }
    })()
  }
  return EditorView.domEventHandlers({
    paste(event, view) {
      const save = getSave()
      if (!save) return false
      const files = extractImagesFromDataTransfer(event.clipboardData, SUPPORTED_PASTE_MIME)
      if (files.length === 0) return false
      event.preventDefault()
      handleFiles(view, files, 'paste')
      return true
    },
    drop(event, view) {
      const save = getSave()
      if (!save) return false
      const files = extractImagesFromDataTransfer(event.dataTransfer, SUPPORTED_DROP_MIME)
      if (files.length === 0) return false
      event.preventDefault()
      handleFiles(view, files, 'drop')
      return true
    },
  })
}
