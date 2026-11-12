/**
 * @jest-environment jsdom
 */
import { javascript } from '@codemirror/lang-javascript'
import { ensureSyntaxTree, foldable, language as languageFacet, LanguageDescription } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import type { Tree } from '@lezer/common'
import { highlightTree, tags as t } from '@lezer/highlight'
import { podliteFoldService } from '../src/foldPodlite'
import { podliteTreeLang } from '../src/podliteMarkdown'

const codeLanguages = [LanguageDescription.of({ name: 'javascript', alias: ['js'], support: javascript() })]
// the parser on its own, reading the whole document at once: what an interrupted parse must match
const wholeParse = (doc: string): Tree => {
  const lang = EditorState.create({ extensions: [podliteTreeLang(codeLanguages)] }).facet(languageFacet)
  if (!lang) throw new Error('no language')
  return lang.parser.parse(doc)
}

// the editor parses a document in parts; a clock that jumps on every call makes the
// first part as short as it can be, so the rest is read as a parse picked up again
const editorTree = (doc: string, interrupted: boolean) => {
  const now = Date.now
  let calls = 0
  if (interrupted) Date.now = () => now() + 1000 * calls++
  let state: EditorState
  try {
    state = EditorState.create({ doc, extensions: [podliteTreeLang(codeLanguages), podliteFoldService] })
  } finally {
    Date.now = now
  }
  const tree = ensureSyntaxTree(state, doc.length, 5000)
  if (!tree) throw new Error('the document was not parsed in time')
  return { tree, state }
}

// the whole tree, nested languages included, as nodes with their ranges and depth
const shape = (tree: Tree): string[] => {
  const out: string[] = []
  let depth = 0
  tree.iterate({
    enter: node => {
      out.push(`${' '.repeat(depth)}${node.name}@${node.from}-${node.to}`)
      depth++
    },
    leave: () => {
      depth--
    },
  })
  return out
}

// every node lies inside its parent
const nested = (tree: Tree): string[] => {
  const stray: string[] = []
  const stack: Array<{ from: number; to: number; name: string }> = []
  tree.iterate({
    enter: node => {
      const parent = stack[stack.length - 1]
      if (parent && (node.from < parent.from || node.to > parent.to))
        stray.push(`${node.name}@${node.from}-${node.to} in ${parent.name}@${parent.from}-${parent.to}`)
      stack.push({ from: node.from, to: node.to, name: node.name })
    },
    leave: () => {
      stack.pop()
    },
  })
  return stray
}

const tagsAt = (tree: Tree, doc: string, text: string): string[] => {
  const from = doc.indexOf(text)
  const names: string[] = []
  highlightTree(
    tree,
    {
      style: tags =>
        tags
          .map(tag => (tag.set.includes(t.operator) ? 'operator' : tag.set.includes(t.keyword) ? 'keyword' : 'other'))
          .join(' '),
    },
    (start, end, style) => {
      if (start <= from && from < end) names.push(...style.split(' '))
    },
  )
  return names
}

describe('a verbatim block written the short way keeps its body when the parse is picked up again', () => {
  it.each<[string, string, string, string]>([
    ['=for assert', '=for assert\n*[ :caption<a, b> ]\n', '*', 'operator'],
    ['=assert', '=assert\n*[ :caption<a, b> ]\n', '*', 'operator'],
    ['=for code :lang<js>', '=for code :lang<js>\nconst a = 1\n', 'const', 'keyword'],
    ['the language on the second settings line', '=for code\n= :id<x>\n= :lang<js>\nconst a = 1\n', 'const', 'keyword'],
    ['=for assert with a settings line', '=for assert\n= :id<x>\n*[ :caption<a, b> ]\n', '*', 'operator'],
  ])('%s', (_, doc, text, tag) => {
    const whole = wholeParse(doc)
    for (const interrupted of [true, false]) {
      const { tree } = editorTree(doc, interrupted)
      expect(shape(tree)).toEqual(shape(whole))
      expect(nested(tree)).toEqual([])
      expect(tagsAt(tree, doc, text)).toContain(tag)
    }
  })

  it.each([
    ['ending with a newline', '=for code\n= :lang<js>\n'],
    ['ending without one', '=for code\n= :lang<js>'],
  ])('keeps a block without a body whole, %s', (_, doc) => {
    const whole = wholeParse(doc)
    for (const interrupted of [true, false]) {
      const { tree } = editorTree(doc, interrupted)
      expect(shape(tree)).toEqual(shape(whole))
      expect(nested(tree)).toEqual([])
      expect(shape(tree)[1]).toBe(` PodDirective@0-${doc.trimEnd().length}`)
    }
  })

  it('reads a long document the same way as a whole parse', () => {
    const doc = `${'x'.repeat(2980)}\n\n=for assert\n*[ :caption<a, b> ]\n\n=para after\n`
    const whole = wholeParse(doc)
    for (const interrupted of [true, false]) {
      const { tree } = editorTree(doc, interrupted)
      expect(shape(tree)).toEqual(shape(whole))
      expect(tagsAt(tree, doc, '*')).toContain('operator')
    }
  })

  it('folds as before', () => {
    const doc = '=head1 A\n\n=begin code\nx\ny\n=end code\n\n=for code\nconst a = 1\nconst b = 2\n\n=head1 B\nz\n'
    for (const interrupted of [true, false]) {
      const { state } = editorTree(doc, interrupted)
      const at = (n: number) => foldable(state, state.doc.line(n).from, state.doc.line(n).to)
      expect([1, 3, 8, 9, 12].map(at)).toEqual([
        { from: 8, to: 70 },
        { from: 21, to: 26 },
        null,
        null,
        { from: 80, to: 82 },
      ])
    }
  })
})
