import { podlitePluggable } from '../src/pluggableParser'
import { bindTarget, buildBindingIndex } from '../src/ast-helpers'

const index = (src: string) => {
  const p = podlitePluggable()
  return buildBindingIndex(p.toAst(p.parse(`=begin pod\n\n${src}\n\n=end pod\n`, { podMode: 1 })))
}

describe('binding an address to a block by :id', () => {
  it('binds a written :id and not one written without a value', () => {
    expect(bindTarget('true', index('=for para :id\nText.')).found).toBe(false)
    expect(bindTarget('true', index('=for para :id<true>\nText.')).found).toBe(true)
  })
})
