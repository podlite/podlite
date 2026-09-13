import { toAnyRules, toHtml, toMarkdown } from '../src'
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

  it('hides a character written as a code, one mask for one character', () => {
    const doc = '=for para :masked\nE<81> E<alpha>'
    hiddenIn(html, doc, ['Q', 'α'])
    expect(html(doc)).toContain('█ █')
  })
})
