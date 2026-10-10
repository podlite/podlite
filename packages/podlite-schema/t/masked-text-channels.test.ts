import {
  getFromTree,
  getMaskedTextContent,
  getTextContentFromNode,
  guardedTextLeaves,
  toAnyRules,
  toHtml,
  toMarkdown,
} from '../src'
import { podlite } from '../../core/src'

type Mode = 'production' | 'draft'

const p = podlite({ importPlugins: true })
const tree = (body: string) => p.toAst(p.parse(`=begin pod\n\n${body}\n\n=end pod\n`, { podMode: 1 }))
const html = (body: string, mode: Mode = 'production') =>
  String(toHtml({ renderMode: mode }).use(toAnyRules('toHtml', p.getPlugins())).run(tree(body)))
const htmlOwnRules = (body: string, mode: Mode = 'production') => String(toHtml({ renderMode: mode }).run(tree(body)))
const markdown = (body: string, mode: Mode = 'production') =>
  String(toMarkdown({ renderMode: mode }).use(toAnyRules('toMarkdown', p.getPlugins())).run(tree(body)))

const hiddenIn = (render: (body: string, mode?: Mode) => string, body: string, words: string[]) => {
  const production = render(body)
  const draft = render(body, 'draft')
  for (const word of words) {
    expect(production).not.toContain(word)
    expect(draft).toContain(word)
  }
}

describe('text a renderer writes from a hidden block is hidden with it', () => {
  it('hides the caption of a table', () => {
    const doc = "=begin table :caption('Dravo Sales') :masked\na b\n=end table"
    hiddenIn(html, doc, ['Dravo'])
    hiddenIn(markdown, doc, ['Dravo'])
  })

  it('hides the title of a boundary', () => {
    hiddenIn(html, "=begin pod :masked\n=for boundary :caption('Brun')\n=end pod", ['Brun'])
  })

  it('hides the alternative text of a picture', () => {
    const doc = '=for picture :masked :alt<Altz>\nimg.png'
    hiddenIn(html, doc, ['Altz'])
    hiddenIn(htmlOwnRules, doc, ['Altz'])
    hiddenIn(markdown, doc, ['Altz'])
  })

  it('hides the title and the file name written on a link', () => {
    const doc = "=for para :masked\nL<words|https://example.org :title('Titz') :download('Dlz')>"
    hiddenIn(html, doc, ['Titz', 'Dlz'])
    hiddenIn(markdown, doc, ['Titz'])
  })

  it('hides text kept with its spaces', () => {
    const doc = '=for para :masked\nS<Snib Space> here'
    hiddenIn(html, doc, ['Snib'])
    hiddenIn(markdown, doc, ['Snib'])
  })

  it('hides the name of an alias that did not resolve', () => {
    const doc = '=for para :masked\nA<Aliz>'
    hiddenIn(html, doc, ['Aliz'])
    hiddenIn(markdown, doc, ['Aliz'])
  })

  it('hides the name a block written in capitals shows as its heading', () => {
    const doc = '=begin SECRETNAME :masked\nBody\n=end SECRETNAME'
    expect(html(doc)).toContain('">██████████</h1>')
    expect(html(doc, 'draft')).toContain('">SECRETNAME</h1>')
    expect(markdown(doc)).not.toContain('# SECRETNAME')
    expect(markdown(doc, 'draft')).toContain('# SECRETNAME')
  })

  it('hides a character written as a code, one mask for one character', () => {
    const doc = '=for para :masked\nE<81> E<alpha>'
    hiddenIn(html, doc, ['Q', 'α'])
    expect(html(doc)).toContain('█ █')
  })
})

describe('text taken out of a node keeps its hidden parts hidden', () => {
  const firstPara = (body: string) => getFromTree(tree(body), 'para')[0]
  const masked = (body: string) => getMaskedTextContent(firstPara(body)).trimEnd()

  it('masks a word in a guard code and keeps the spaces', () => {
    expect(masked('=for para\nProject G<Aurora> notes')).toBe('Project ██████ notes')
  })

  it('masks the whole text of a masked block', () => {
    expect(masked('=for para :masked\nAll of it')).toBe('███ ██ ██')
  })

  it('masks a guard code that holds a single code', () => {
    expect(masked('=for para\nProject G<S<secret>>')).toBe('Project ██████')
    expect(masked('=for para\nProject G<V<secret>>')).toBe('Project ██████')
  })

  it('gives the leaves in order with their marks', () => {
    expect(guardedTextLeaves(firstPara('=for para\nOne G<two> three'))).toEqual([
      { value: 'One ', guarded: false },
      { value: 'two', guarded: true },
      { value: ' three\n', guarded: false },
    ])
  })

  it('gives the same text as before when nothing is hidden', () => {
    const para = firstPara('=for para\nPlain B<bold> C<code> I<it> L<link|https://example.org>')
    expect(getMaskedTextContent(para)).toBe(getTextContentFromNode(para))
  })
})
