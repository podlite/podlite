/**
 * @jest-environment jsdom
 */
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorSelection, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { podliteDecorations } from '../src/podliteDecorations'
import { podliteTreeLang } from '../src/podliteMarkdown'

// no language is handed in for fences: in jsdom the parse of a nested language
// never finishes, and an unfinished parse leaves the whole document unread
const marked = (doc: string, at?: number, lang: any = podliteTreeLang([])): Array<[string, string]> => {
  const state = EditorState.create({
    doc,
    extensions: [lang, podliteDecorations()],
    selection: at === undefined ? undefined : EditorSelection.cursor(at),
  })
  const view = new EditorView({ state, parent: document.body })
  const out = Array.from(view.dom.querySelectorAll('[class*="cm-pod-"]')).map(
    el => [(el as HTMLElement).className, el.textContent || ''] as [string, string],
  )
  view.destroy()
  return out
}

describe('what a colour cannot show', () => {
  it('covers content the author keeps out of what is published', () => {
    expect(marked('Password G<hunter2> onwards\n', 0)).toEqual([['cm-pod-covered', 'hunter2']])
  })

  it('uncovers it while the caret stands inside', () => {
    const doc = 'Password G<hunter2> onwards\n'
    expect(marked(doc, doc.indexOf('hunter2') + 2)).toEqual([])
  })

  it('leaves the letter and the brackets in place', () => {
    // the caret stands at the end of the line, away from the code
    const [[, text]] = marked('G<naïve> and tail\n', 15)
    expect(text).toBe('naïve')
  })

  it('colours the settings of a fenced block apart from the language', () => {
    const doc = '```js :caption<Example> :lineno\nvar i = 0\n```\n'
    expect(marked(doc, 0)).toEqual([
      ['cm-pod-fence-attr-name', ':caption'],
      ['cm-pod-fence-attr-value', '<Example>'],
      ['cm-pod-fence-attr-name', ':lineno'],
    ])
  })

  it('does the same in a markdown file', () => {
    const doc = '```js :caption<Example>\nvar i = 0\n```\n'
    const found = marked(doc, 0, markdown({ base: markdownLanguage }))
    expect(found.map(([cls]) => cls)).toEqual(['cm-pod-fence-attr-name', 'cm-pod-fence-attr-value'])
  })

  it('leaves a fence with a language alone', () => {
    expect(marked('```js\nvar i = 0\n```\n', 0)).toEqual([])
  })
})
