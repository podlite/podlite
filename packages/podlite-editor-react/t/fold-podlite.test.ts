/**
 * @jest-environment jsdom
 */
import { foldable } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { podliteFoldService } from '../src/foldPodlite'
import { podliteTreeLang } from '../src/podliteMarkdown'

const foldAt = (doc: string, needle: string): { from: number; to: number } | null => {
  const state = EditorState.create({ doc, extensions: [podliteTreeLang([]), podliteFoldService] })
  const line = state.doc.lineAt(doc.indexOf(needle))
  return foldable(state, line.from, line.to)
}

describe('folding a Podlite document', () => {
  it('folds a delimited block and a section', () => {
    expect(foldAt('=begin pod\ntext\n=end pod\n', '=begin pod')).not.toBeNull()
    expect(foldAt('=head1 Title\ntext\nmore\n', '=head1')).not.toBeNull()
  })

  it('offers nothing inside a block taken as written', () => {
    const doc = '=begin code\n=head1 Not a heading\ntext\n=end code\n'
    expect(foldAt(doc, '=head1')).toBeNull()
  })

  // the old scan knew five names, the tree knows every block whose content is
  // taken as written — a table and a formula among them
  it('offers nothing inside a table or a formula either', () => {
    expect(foldAt('=begin table\n=head1 Not a heading\n=end table\n', '=head1')).toBeNull()
    expect(foldAt('=begin formula\n=head1 Not a heading\n=end formula\n', '=head1')).toBeNull()
    expect(foldAt('=begin data-table\n=head1 Not a heading\n=end data-table\n', '=head1')).toBeNull()
  })

  // markdown is the exception: its content is a document in its own right
  it('keeps folding inside a markdown block', () => {
    const doc = '=begin markdown\n=head1 Heading\ntext\n\n=end markdown\n'
    expect(foldAt(doc, '=head1')).not.toBeNull()
  })
})
