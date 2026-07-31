import { parseDiagnostics, toEditorDiagnostics } from '../src/diagnostics'

const doc = '=begin pod\n\n=for para :tags[a,b]\ntext\n\n=end pod\n'

describe('parse diagnostics in the editor', () => {
  it('finds a dropped attribute value', () => {
    const found = parseDiagnostics(doc)
    expect(found).toHaveLength(1)
    expect(found[0].message).toContain('Square brackets')
    expect(found[0].location.start.line).toBe(3)
  })

  it('returns nothing for a document with readable values', () => {
    expect(parseDiagnostics('=for para :tags<a b>\ntext\n')).toEqual([])
  })

  it('maps a diagnostic to a marked range', () => {
    const [marked] = toEditorDiagnostics(parseDiagnostics(doc), 1)
    expect(marked.severity).toBe('warning')
    expect(doc.slice(marked.from, marked.to)).toBe('[a,b]')
  })

  it('stays quiet on the line under the caret', () => {
    expect(toEditorDiagnostics(parseDiagnostics(doc), 3)).toEqual([])
  })
})
