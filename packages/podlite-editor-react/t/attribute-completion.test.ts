/**
 * @jest-environment jsdom
 */
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { ATTRIBUTE_NAMES } from '@podlite/schema'
import { podliteTreeLang, inAttributeZone, attributeNamesInDocument } from '../src/podliteMarkdown'

const stateOf = (doc: string) => {
  const state = EditorState.create({ doc, extensions: [podliteTreeLang([])] })
  // the tree is built lazily, so a view is mounted to make the parse happen
  const view = new EditorView({ state, parent: document.body })
  const built = view.state
  view.destroy()
  return built
}

const at = (doc: string, marker: string): [EditorState, number] => {
  const pos = doc.indexOf(marker) + marker.length
  return [stateOf(doc), pos]
}

describe('where the settings of a block are written', () => {
  it('is the rest of the header line of a delimited block', () => {
    const [state, pos] = at('=begin code :lang<js>\nx\n=end code\n', '=begin code ')
    expect(inAttributeZone(state, pos)).toBe(true)
  })

  it('is the rest of the header of a paragraph block', () => {
    const [state, pos] = at('=for para :id<x>\ntext\n', '=for para ')
    expect(inAttributeZone(state, pos)).toBe(true)
  })

  it('is a continuation line opened by a bare equals sign', () => {
    const [state, pos] = at('=begin code\n= :lang<js>\nx\n=end code\n', '= :')
    expect(inAttributeZone(state, pos)).toBe(true)
  })

  it('is not the body of the document', () => {
    const [state, pos] = at('=begin code :lang<js>\nplain text here\n=end code\n', 'plain text ')
    expect(inAttributeZone(state, pos)).toBe(false)
  })

  it('is not a directive that takes no settings', () => {
    const [state, pos] = at('=head1 A heading here\n', '=head1 A ')
    expect(inAttributeZone(state, pos)).toBe(false)
  })
})

describe('the names offered', () => {
  it('holds the standard names the specification gives', () => {
    for (const name of ['id', 'caption', 'lang', 'allow', 'folded', 'numbered', 'checked', 'nested']) {
      expect(ATTRIBUTE_NAMES).toContain(name)
    }
  })

  it('collects the names already written in the document', () => {
    const state = stateOf('=for para :id<a> :caption<x>\ntext\n\n=for para :summary<y>\nmore\n')
    const found = attributeNamesInDocument(state)
    expect(found).toContain('id')
    expect(found).toContain('caption')
    expect(found).toContain('summary')
  })

  it('takes no name from the body of the document', () => {
    const state = stateOf('=begin pod\n\nprose with a colon: not a setting\n\n=end pod\n')
    expect(attributeNamesInDocument(state)).toEqual([])
  })
})
