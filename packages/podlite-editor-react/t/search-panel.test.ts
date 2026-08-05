/**
 * @jest-environment jsdom
 */
import { openSearchPanel, search } from '@codemirror/search'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { podliteTreeLang } from '../src/podliteMarkdown'

describe('find and replace', () => {
  it('opens its panel', () => {
    const view = new EditorView({
      state: EditorState.create({ doc: 'text\n', extensions: [podliteTreeLang([]), search({ top: true })] }),
      parent: document.body,
    })
    const opened = openSearchPanel(view)
    const panels = view.dom.querySelectorAll('.cm-panels .cm-search').length
    view.destroy()
    expect({ opened, panels }).toEqual({ opened: true, panels: 1 })
  })
})
