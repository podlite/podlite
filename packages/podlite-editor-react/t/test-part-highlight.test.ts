/**
 * @jest-environment jsdom
 */
import { javascript } from '@codemirror/lang-javascript'
import { ensureSyntaxTree, foldable, LanguageDescription } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { highlightTree, tags as t } from '@lezer/highlight'
import type { Tag } from '@lezer/highlight'
import { podliteFoldService } from '../src/foldPodlite'
import { podliteTreeLang } from '../src/podliteMarkdown'

// loaded here rather than through language-data, whose lazy import needs a flag jest does not have
const codeLanguages = [LanguageDescription.of({ name: 'javascript', alias: ['js'], support: javascript() })]

const NAMED: Array<[Tag, string]> = [
  [t.keyword, 'keyword'],
  [t.operator, 'operator'],
  [t.macroName, 'macroName'],
  [t.tagName, 'tagName'],
  [t.variableName, 'variableName'],
  [t.attributeName, 'attributeName'],
  [t.string, 'string'],
  [t.url, 'url'],
  [t.processingInstruction, 'processingInstruction'],
  [t.strong, 'strong'],
  [t.heading, 'heading'],
  [t.content, 'content'],
]

const nameOf = (tag: Tag): string[] => NAMED.filter(([known]) => tag.set.includes(known)).map(([, name]) => name)

const read = (doc: string) => {
  const state = EditorState.create({ doc, extensions: [podliteTreeLang(codeLanguages), podliteFoldService] })
  const tree = ensureSyntaxTree(state, doc.length, 5000)
  if (!tree) throw new Error('the document was not parsed in time')
  const spans: Array<{ from: number; to: number; names: string[] }> = []
  highlightTree(tree, { style: tags => tags.flatMap(nameOf).join(' ') || null }, (from, to, names) =>
    spans.push({ from, to, names: names.split(' ') }),
  )
  // the tags at the start of a piece of text, and whether a verbatim body holds it
  const at = (text: string, occurrence = 0) => {
    let from = -1
    for (let i = 0; i <= occurrence; i++) from = doc.indexOf(text, from + 1)
    if (from < 0) throw new Error(`no ${text} in the document`)
    const span = spans.find(s => s.from <= from && from < s.to)
    let inBody = false
    const names: string[] = []
    for (let node: any = tree.resolveInner(from, 1); node; node = node.parent) {
      names.push(node.name)
      if (node.name === 'PodVerbatim') inBody = true
    }
    return { tags: span ? span.names : [], nodes: names, inBody }
  }
  return { at, state }
}

describe('a fixture is highlighted as a Podlite document', () => {
  it('reads the blocks and settings inside a delimited fixture, and folds nothing there', () => {
    const doc = '=begin fixture\n=head1 A\n=for para :id<x>\ntext\n=end fixture\n'
    const { at, state } = read(doc)
    expect(at('=head1').nodes).toEqual(expect.arrayContaining(['PodKeyword', 'PodVerbatim']))
    expect(at('A\n').nodes).toContain('PodHead1')
    expect(at('para').nodes[0]).toBe('PodBlockName')
    expect(at(':id').nodes[0]).toBe('PodAttrName')
    expect(at('<x>').nodes[0]).toBe('PodAttrValue')
    expect(at('para').inBody).toBe(true)
    const line = state.doc.lineAt(doc.indexOf('=head1'))
    expect(foldable(state, line.from, line.to)).toBeNull()
  })

  it('reads markup codes in a paragraph and an abbreviated fixture', () => {
    expect(read('=for fixture\ntext with B<bold>\n').at('bold').tags).toContain('strong')
    expect(read('=fixture\ntext with B<bold>\n').at('bold').tags).toContain('strong')
  })

  it('reads a fixture with the whole editor language, a code block in it included', () => {
    const { at } = read('=begin fixture\n=begin code :lang<js>\nconst a = 1\n=end code\n=end fixture\n')
    expect(at('const').tags).toContain('keyword')
    expect(at('const').inBody).toBe(true)
  })

  it('takes :lang over the name of the block, and an empty :lang for none', () => {
    expect(read('=begin fixture\ntext with B<bold>\n=end fixture\n').at('bold').tags).toContain('strong')
    expect(read('=begin fixture :lang<js>\nconst a = 1\n=end fixture\n').at('const').tags).toContain('keyword')
    expect(read('=begin fixture :lang<>\ntext with B<bold>\n=end fixture\n').at('bold').tags).toContain('strong')
  })
})

describe('an assertion is highlighted as a selector', () => {
  it('marks a block name, a predicate and a condition', () => {
    const { at } = read('=for assert\nhead1[ :!?number ]\n')
    expect(at('head1').tags).toEqual(['operator'])
    expect(at('[').tags).toEqual(['processingInstruction'])
    expect(at(':!?number').tags).toEqual(['attributeName'])
    expect(at(']').tags).toEqual(['processingInstruction'])
    expect(at('head1').inBody).toBe(true)
  })

  it('keeps the membership mark apart from its value', () => {
    const { at } = read('=for assert\npara[ :lang~<x y> ]\n')
    expect(at('~').tags).toEqual(['operator'])
    expect(at('<x y>').tags).toEqual(['string'])
  })

  it('marks a source, its scheme and the kinds of block names', () => {
    const { at } = read('=for assert\nfile:./a.podlite | head1, Mermaid, SYNOPSIS, foo\n')
    expect(at('file:').tags).toEqual(['keyword'])
    expect(at('./a.podlite').tags).toEqual(['url'])
    expect(at('|').tags).toEqual(['processingInstruction'])
    expect(at(',').tags).toEqual(['processingInstruction'])
    expect(at('head1').tags).toEqual(['operator'])
    expect(at('Mermaid').tags).toEqual(['tagName'])
    expect(at('SYNOPSIS').tags).toEqual(['macroName'])
    expect(at('foo').tags).toEqual(['variableName'])
    const doc = read('=for assert\ndoc:Guide | head1\n')
    expect(doc.at('doc:').tags).toEqual(['keyword'])
    expect(doc.at('Guide').tags).toEqual(['url'])
  })

  it('marks a source written without a scheme by the bar after it', () => {
    const { at } = read('=for assert\narticle.podlite | head1\n')
    expect(at('article.podlite').tags).toEqual(['url'])
    expect(at('head1').tags).toEqual(['operator'])
  })

  it('marks an operation in parentheses with its operands', () => {
    const quoted = read("=for assert\nInvoice[ :status(in 'draft','issued') ]\n")
    expect(quoted.at('(').tags).toEqual(['processingInstruction'])
    expect(quoted.at('in ').tags).toEqual(['keyword'])
    expect(quoted.at("'draft'").tags).toEqual(['string'])
    const selected = read('=for assert\nInvoice[ :type(in vocabulary.podlite | defn) ]\n')
    expect(selected.at('vocabulary.podlite').tags).toEqual(['url'])
    expect(selected.at('defn').tags).toEqual(['operator'])
  })

  it('reads an operation that goes on over two lines of a delimited assertion', () => {
    const { at } = read('=begin assert\nInvoice[ :type(in\n  file:./v.podlite | defn) ]\n=end assert\n')
    expect(at('in\n').tags).toEqual(['keyword'])
    expect(at('defn').tags).toEqual(['operator'])
    expect(at(')').tags).toEqual(['processingInstruction'])
  })

  it('reads True and False in parentheses as values', () => {
    const { at } = read('=for assert\nhead1[ :ready(True) :missing(False) ]\n')
    expect(at('True').tags).toEqual(['string'])
    expect(at('False').tags).toEqual(['string'])
  })

  it('keeps a comma inside a value and a star as an operator', () => {
    const { at } = read('=for assert\n*[ :caption<a, b> ]\n')
    expect(at('*').tags).toEqual(['operator'])
    expect(at('<a, b>').tags).toEqual(['string'])
    expect(at(', b').tags).toEqual(['string'])
  })

  it('takes no :lang from the data of an abbreviated assertion', () => {
    const { at } = read('=assert head1[ :lang<js> ]\n, para\n')
    expect(at(', para').tags).toEqual(['processingInstruction'])
    expect(at('para').tags).toEqual(['operator'])
  })
})

describe('a resource is highlighted by the extension of its name', () => {
  it('reads Markdown, Podlite or nothing', () => {
    const md = read('=begin resource :name<x.md>\n# Title\n```js\nconst a = 1\n```\n=head1 X\n=end resource\n')
    expect(md.at('Title').tags).toContain('heading')
    expect(md.at('const').tags).toContain('keyword')
    expect(md.at('=head1').nodes).not.toContain('PodKeyword')
    expect(read('=begin resource :name<x.markdown>\n# Title\n=end resource\n').at('Title').tags).toContain('heading')
    for (const name of ['x.podlite', 'x.pod6']) {
      expect(read(`=begin resource :name<${name}>\n=head1 A\n=end resource\n`).at('=head1').nodes).toContain(
        'PodKeyword',
      )
    }
    expect(read('=for resource\n= :name<x.md>\n# Title\n').at('Title').tags).toContain('heading')
    expect(read('=begin resource :name<x.txt>\n# Title\n=end resource\n').at('Title').tags).not.toContain('heading')
  })

  it('reads :name as an option of its own, in any form of value', () => {
    expect(read("=begin resource :name'x.md'\n# Title\n=end resource\n").at('Title').tags).toContain('heading')
    expect(read("=begin resource :name('x.md')\n# Title\n=end resource\n").at('Title').tags).toContain('heading')
    const inside = read("=begin resource :caption(':name<x.txt>') :name<x.md>\n# Title\n=end resource\n")
    expect(inside.at('Title').tags).toContain('heading')
    const quoted = read("=begin resource :caption(':name<x.md>')\n# Title\n=end resource\n")
    expect(quoted.at('Title').tags).not.toContain('heading')
  })
})
