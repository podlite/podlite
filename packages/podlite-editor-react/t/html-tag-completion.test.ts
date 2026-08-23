/**
 * @jest-environment jsdom
 */
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { autocompletion } from '@codemirror/autocomplete'
import { EditorSelection, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { podliteTreeLang } from '../src/podliteMarkdown'

// The tag list is offered by a completion source the markdown language puts in
// its language data. Asking the state for the sources at the caret is the same
// question the editor asks when the caret moves.
const sourcesAt = (extension: any, doc: string, at: number): readonly unknown[] => {
  const state = EditorState.create({
    doc,
    extensions: [extension, autocompletion()],
    selection: EditorSelection.cursor(at),
  })
  const view = new EditorView({ state, parent: document.body })
  const found = view.state.languageDataAt<unknown>('autocomplete', at)
  view.destroy()
  return found
}

const afterAngle = (doc: string) => doc.indexOf('<') + 1

describe('the HTML tag list', () => {
  it('is not offered in a Podlite document', () => {
    const doc = 'Password C<hunter2> onwards\n'
    expect(sourcesAt(podliteTreeLang([]), doc, afterAngle(doc))).toHaveLength(0)
  })

  it('is not offered in an attribute value either', () => {
    const doc = '=for code :lang<js>\nconst x = 1\n'
    expect(sourcesAt(podliteTreeLang([]), doc, afterAngle(doc))).toHaveLength(0)
  })

  it('stays where a markdown file expects it', () => {
    const doc = 'text <\n'
    const md = markdown({ base: markdownLanguage, codeLanguages: [] })
    expect(sourcesAt(md, doc, afterAngle(doc)).length).toBeGreaterThan(0)
  })
})
