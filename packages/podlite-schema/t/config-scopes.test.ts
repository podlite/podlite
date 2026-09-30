import { parseAttributes, walkConfigScopes } from '../src'
import { podlitePluggable } from '../src/pluggableParser'

const read = (src: string) => {
  const p = podlitePluggable()
  return p.toAst(p.parse(src, { podMode: 1 }))
}
const allowAt = (src: string, inherited = {}) => {
  const seen: Record<string, string[]> = {}
  walkConfigScopes(read(src), inherited, (block, scope) => {
    if (block.name !== 'para') return
    const text = JSON.stringify(block)
    const mark = ['first', 'second', 'third'].find(word => text.includes(word))
    if (mark) seen[mark] = Object.keys(scope).sort()
  })
  return seen
}

describe('walkConfigScopes', () => {
  it('gives a block the settings declared before it', () => {
    expect(allowAt('=begin pod\n=para first\n\n=config code :allow<B>\n\n=para second\n=end pod\n')).toEqual({
      first: [],
      second: ['code'],
    })
  })

  it('keeps what a block declares inside it', () => {
    const src =
      '=begin pod\n=begin nested\n=config code :allow<B>\n\n=para first\n=end nested\n\n=para second\n=end pod\n'
    expect(allowAt(src)).toEqual({ first: ['code'], second: [] })
  })

  it('starts from the settings handed in and leaves them as they were', () => {
    const inherited = { table: parseAttributes(':caption<T>') }
    expect(allowAt('=begin pod\n=config code :allow<B>\n\n=para first\n=end pod\n', inherited)).toEqual({
      first: ['code', 'table'],
    })
    expect(Object.keys(inherited)).toEqual(['table'])
  })
})
