/**
 * @jest-environment jsdom
 */
import { javascript } from '@codemirror/lang-javascript'
import { ensureSyntaxTree, LanguageDescription, syntaxTree } from '@codemirror/language'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { podliteTreeLang, suggestionContextAt, markdownHeadingStyle } from '../src/podliteMarkdown'
import { defaultTheme } from '../src/theme'

// loaded here rather than through language-data, whose lazy import needs a flag jest does not have
const codeLanguages = [LanguageDescription.of({ name: 'javascript', alias: ['js'], support: javascript() })]

const spans = (doc: string, lang: any): string[] => {
  const view = new EditorView({
    state: EditorState.create({ doc, extensions: [lang, defaultTheme] }),
    parent: document.body,
  })
  // jsdom runs no idle work, so a parse left half-done colours only part of the
  // document; under a full suite that turned into a test failing by timing alone
  ensureSyntaxTree(view.state, doc.length, 5000)
  view.dispatch({ changes: { from: 0, insert: '' } })
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
  it('shows plain markdown the same way in both languages, apart from headings', () => {
    const doc = ['# Heading', '', 'text with **bold** and [a link](/a)', '', '- item'].join('\n')
    // a heading carries the shared heading style here; plain markdown leaves it out
    const exceptHeading = (found: string[]) => found.filter(s => !/\|#$|\|\s*Heading$/.test(s))
    const tree = spans(doc, podliteTreeLang(codeLanguages))
    expect(tree.length).toBeGreaterThan(4)
    expect(exceptHeading(tree)).toEqual(exceptHeading(spans(doc, markdown({ base: markdownLanguage, codeLanguages }))))
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

  it('reads the body of a code block by the language its settings name', () => {
    const doc = '=begin code :lang<js>\nconst x = 1\n=end code\n'
    const state = EditorState.create({ doc, extensions: [podliteTreeLang(codeLanguages)] })
    const names: string[] = []
    ensureSyntaxTree(state, doc.length, 5000)
    syntaxTree(state).iterate({ enter: n => void names.push(n.name) })
    expect(names).toContain('VariableDefinition')
    expect(names).toContain('PodVerbatim')
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

  it('gives a heading the same weight and colour in a markdown file as in a podlite one', () => {
    // a .md file goes through the stock markdown language, not the podlite one
    const mdFile = markdown({ base: markdownLanguage, codeLanguages, extensions: [markdownHeadingStyle] })
    const classOf = (doc: string, word: string, lang: any) =>
      spans(doc, lang)
        .find(s => s.split('|')[1]?.includes(word))
        ?.split('|')[0]
    expect(classOf('# One\n', 'One', mdFile)).toBe(classOf('=head1 One\n', 'One', podliteTreeLang(codeLanguages)))
  })

  it('gives a heading the same weight and colour in both languages', () => {
    const lang = podliteTreeLang(codeLanguages)
    const classOf = (doc: string, word: string) =>
      spans(doc, lang)
        .find(s => s.split('|')[1]?.includes(word))
        ?.split('|')[0]
    expect(classOf('=head1 One\n', 'One')).toBe(classOf('# One\n', 'One'))
  })

  it('sizes a heading by its level', () => {
    const doc = '=head1 One\n\n=head2 Two\n\n=head3 Three\n'
    const state = EditorState.create({ doc, extensions: [podliteTreeLang(codeLanguages)] })
    ensureSyntaxTree(state, doc.length, 5000)
    const names: string[] = []
    syntaxTree(state).iterate({ enter: n => void names.push(n.name) })
    expect(names).toEqual(expect.arrayContaining(['PodHead1', 'PodHead2', 'PodHead3']))
    const found = spans(doc, podliteTreeLang(codeLanguages))
    const cls = (word: string) => found.find(s => s.split('|')[1]?.includes(word))?.split('|')[0]
    // three levels reach three sizes, so three different classes
    expect(new Set([cls('One'), cls('Two'), cls('Three')]).size).toBe(3)
  })
})
