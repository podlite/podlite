import { getFromTree } from '../src'
import { podlitePluggable } from '../src/pluggableParser'

const read = (src: string) => {
  const p = podlitePluggable()
  return p.toAst(p.parse(src, { podMode: 1 }))
}
const body = (src: string, name: string) => {
  const [block] = getFromTree(read(src), name)
  return block && typeof block === 'object' && 'content' in block ? block.content : []
}
const indented = (name: string, lines: string[]) =>
  ['=begin pod', `  =begin ${name}`, ...lines, `  =end ${name}`, '=end pod', ''].join('\n')

describe('a blank line in the body of an indented delimited block', () => {
  it.each(['code', 'markdown', 'Xhtml'])('is kept in =%s', name => {
    expect(body(indented(name, ['  a', '', '  b']), name)).toEqual([
      expect.objectContaining({ type: 'verbatim', value: 'a\n\nb\n' }),
    ])
  })

  it('is kept when the line holds spaces short of the margin', () => {
    expect(body(indented('code', ['  a', ' ', '  b']), 'code')).toEqual([
      expect.objectContaining({ type: 'verbatim', value: 'a\n\nb\n' }),
    ])
  })

  it('is kept at the start and at the end of the body', () => {
    expect(body(indented('code', ['', '  a', '']), 'code')).toEqual([
      expect.objectContaining({ type: 'verbatim', value: '\na\n\n' }),
    ])
  })

  it('leaves a line indented less than the margin without its indent', () => {
    expect(body(indented('code', [' a', '    b']), 'code')).toEqual([
      expect.objectContaining({ type: 'verbatim', value: 'a\n  b\n' }),
    ])
  })

  it('reads the body of a block with no indent as before', () => {
    expect(body('=begin code\na\n\nb\n=end code\n', 'code')).toEqual([
      expect.objectContaining({ type: 'verbatim', value: 'a\n\nb\n' }),
    ])
  })
})
