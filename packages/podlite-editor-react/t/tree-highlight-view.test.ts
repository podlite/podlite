/**
 * @jest-environment jsdom
 */
import { javascript } from '@codemirror/lang-javascript'
import { LanguageDescription } from '@codemirror/language'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { podliteTreeLang, suggestionContextAt } from '../src/podliteMarkdown'
import { defaultTheme } from '../src/theme'

// loaded here rather than through language-data, whose lazy import needs a flag jest does not have
const codeLanguages = [LanguageDescription.of({ name: 'javascript', alias: ['js'], support: javascript() })]

const spans = (doc: string, lang: any): string[] => {
  const view = new EditorView({
    state: EditorState.create({ doc, extensions: [lang, defaultTheme] }),
    parent: document.body,
  })
  const out = Array.from(view.dom.querySelectorAll('.cm-line span')).map(
    s => `${(s as HTMLElement).className}|${s.textContent}`,
  )
  view.destroy()
  return out
}

// a fenced block is left out on purpose: jsdom runs no idle work, so the parse of
// the language inside the fence never finishes and nothing on the page is coloured.
// That case is checked on the tree, in podlite-markdown.test.ts
describe('the live view', () => {
  it('shows plain markdown the same way in both languages', () => {
    const doc = ['# Heading', '', 'text with **bold** and [a link](/a)', '', '- item'].join('\n')
    const tree = spans(doc, podliteTreeLang(codeLanguages))
    expect(tree.length).toBeGreaterThan(4)
    expect(tree).toEqual(spans(doc, markdown({ base: markdownLanguage, codeLanguages })))
  })

  it('colours a directive line', () => {
    const found = spans('=begin pod :id<x>\n\ntext\n', podliteTreeLang(codeLanguages))
    const text = (s: string) => s.slice(s.indexOf('|') + 1)
    expect(found.map(text)).toEqual(expect.arrayContaining(['=begin', 'pod', ':id', '<x>']))
    expect(found.every(s => s.indexOf('|') > 0)).toBe(true)
  })

  it('tells where the caret stands from the state, without parsing again', () => {
    const doc = '=para one\n=begin markdown\ntext\n=end markdown\n'
    const state = EditorState.create({ doc, extensions: [podliteTreeLang(codeLanguages)] })
    expect(suggestionContextAt(state, doc.indexOf('one'))).toBe('pod6')
    expect(suggestionContextAt(state, doc.indexOf('text'))).toBe('md')
  })

  it('colours a name the author brought in apart from a standard one', () => {
    const found = spans('=begin Image\ntext\n=end Image\n', podliteTreeLang(codeLanguages))
    const image = found.find(s => s.endsWith('|Image'))
    const standard = spans('=begin code\ntext\n=end code\n', podliteTreeLang(codeLanguages)).find(s =>
      s.endsWith('|code'),
    )
    expect(image).toBeDefined()
    expect(standard).toBeDefined()
    expect(image?.split('|')[0]).not.toBe(standard?.split('|')[0])
  })
})
