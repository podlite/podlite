import { frozenIds, getFromTree, validatePodliteAst } from '@podlite/schema'
import { podlite, readerFor, writtenTree } from '../src'
import { assembleIncludes, sourcesFromFiles } from '../src/assemble'

const core = podlite({ importPlugins: true })
const read = readerFor(core)
const html = (tree: any) => getFromTree(tree, 'Html') as any[]

describe('the mark of markdown on the way through the core', () => {
  it('marks the blocks of a =markdown block and of a document read as markdown, not the blocks of the author', () => {
    const tree = core.toAst(core.parse('=begin markdown\nA <br> x\n=end markdown\n\n=Html <i>y</i>\n', { podMode: 1 }))
    expect(html(tree).map(block => block.sourceFormat)).toEqual(['markdown', undefined])
    expect(tree.sourceFormat).toBeUndefined()
    const md = core.toAst(core.parse('A <b>x</b>\n', { mode: 'md' }))
    expect(md.sourceFormat).toBe('markdown')
    expect(html(md)[0].sourceFormat).toBe('markdown')
  })

  it('keeps the mark of an included markdown file and of a block selected from it', () => {
    const files = { 'part.md': 'A <br> x\n\n<div>\nz\n</div>\n' }
    const assembled = (text: string) =>
      assembleIncludes(read(text, 'input.podlite'), {
        sources: sourcesFromFiles(files),
        context: '',
        file: 'input.podlite',
        self: '/input.podlite',
        parse: read,
        onError: () => undefined,
        onWarning: () => undefined,
      })
    const whole = assembled('=begin pod\n=include file:part.md\n=end pod\n')
    expect(html(whole).map(block => block.sourceFormat)).toEqual(['markdown', 'markdown'])
    const picked = assembled('=begin pod\n=include file:part.md | Html\n=end pod\n')
    expect(html(picked).length).toBeGreaterThan(0)
    expect(html(picked).every(block => block.sourceFormat === 'markdown')).toBe(true)
  })

  it('keeps the mark through frozen ids and through JSON', () => {
    const tree = core.toAst(core.parse('A <b>x</b>\n', { mode: 'md' }))
    expect(html(frozenIds()(tree))[0].sourceFormat).toBe('markdown')
    expect(html(JSON.parse(JSON.stringify(tree)))[0].sourceFormat).toBe('markdown')
  })

  it('marks the tree a markdown file is written as, and leaves a document of the author valid and unmarked', () => {
    const md = writtenTree(core, 'A <br> x\n', 'md')
    expect(md.sourceFormat).toBe('markdown')
    expect(html(md)[0].sourceFormat).toBe('markdown')
    const pod = core.toAst(core.parse('=begin pod\n=para A\n=end pod\n', { podMode: 1 }))
    expect(validatePodliteAst(pod)).toEqual([])
    expect(JSON.stringify(pod)).not.toContain('sourceFormat')
  })
})
