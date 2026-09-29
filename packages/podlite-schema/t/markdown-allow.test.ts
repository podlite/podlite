import { getFromTree } from '../src'
import { podlitePluggable } from '../src/pluggableParser'

const read = (src: string) => {
  const p = podlitePluggable()
  return p.toAst(p.parse(src, { podMode: 1 }))
}
const body = (src: string) => {
  // a =config for the block answers to its name as well
  const block = getFromTree(read(src), 'markdown').find(node => typeof node === 'object' && node.type === 'block')
  return block && typeof block === 'object' && 'content' in block ? block.content : []
}
const markdown = '# Title\n\n**bold**\n'

describe('the body of a =markdown block under :allow', () => {
  it('stays as written when :allow is on the block', () => {
    expect(body(`=begin markdown :allow<B>\n${markdown}=end markdown\n`)).toEqual([
      expect.objectContaining({ type: 'verbatim', value: markdown }),
    ])
    expect(body('=for markdown :allow<B>\n# Title\n')).toEqual([
      expect.objectContaining({ type: 'verbatim', value: '# Title\n' }),
    ])
  })

  it('stays as written when a =set before the block gives it :allow', () => {
    expect(body(`=set :allow<B>\n=begin markdown\n${markdown}=end markdown\n`)).toEqual([
      expect.objectContaining({ type: 'verbatim', value: markdown }),
    ])
  })

  it('stays as written when =config gives the block :allow', () => {
    expect(body(`=config markdown :allow<B>\n\n=begin markdown\n${markdown}=end markdown\n`)).toEqual([
      expect.objectContaining({ type: 'verbatim', value: markdown }),
    ])
  })

  it('leaves :allow acting on a code block', () => {
    const [code] = getFromTree(read('=begin code :allow<B>\nB<x>\n=end code\n'), 'code')
    expect(JSON.stringify(code)).toContain('"fcode"')
  })
})
