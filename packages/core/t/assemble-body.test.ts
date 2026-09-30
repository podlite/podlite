import { getFromTree, parseAttributes, runSelector } from '@podlite/schema'
import type { PodliteDocument } from '@podlite/schema'
import { podlite, readerFor } from '../src'
import { assembleAsync, assembleIncludes, sourcesFromFiles } from '../src/assemble'
import type { AsyncSources, IncludeProblem, IncludeStep, Located } from '../src/assemble'

const p = podlite({ importPlugins: true })
// the reader the host gives the assembly reads the bodies of included files as well
const read = readerFor(p, { body: block => block.name === 'React' })
const main = '/lib/main.podlite'

const assembled = (text: string, files: Record<string, string>) => {
  const problems: IncludeProblem[] = []
  const tree = assembleIncludes(read(text, main), {
    sources: sourcesFromFiles(files),
    context: '/lib',
    file: main,
    text,
    parse: read,
    onError: problem => problems.push(problem),
    onWarning: problem => problems.push(problem),
  })
  return { tree, problems }
}
const react = (tree: any, n = 0): any => getFromTree(tree, 'React')[n]
const count = (selector: string, tree: PodliteDocument): number =>
  runSelector(selector, [{ file: main, node: tree }]).length
const texts = (node: any): string[] => getFromTree(node, 'para').map(para => JSON.stringify(para))

describe('an include written in the body of a block the host names', () => {
  const files = {
    '/lib/part.podlite': '=begin pod\n=begin code\nB<x>\n=end code\n=end pod\n',
    '/lib/holder.podlite':
      '=begin pod\n=begin React\n=para in the body\n\n=begin code\nB<y>\n=end code\n=end React\n=end pod\n',
  }

  it('is assembled', () => {
    const text = '=begin pod\n=begin React\n=para before\n\n=include file:part.podlite\n=end React\n=end pod\n'
    const { tree, problems } = assembled(text, files)
    expect(problems).toEqual([])
    expect(getFromTree(react(tree), 'include')).toEqual([])
    expect(getFromTree(react(tree), 'code').length).toBe(1)
  })

  it('brings its file read with the settings in effect at the block', () => {
    const text =
      '=begin pod\n=config code :allow<B>\n\n=begin React\n=include file:part.podlite\n=end React\n=end pod\n'
    const { tree, problems } = assembled(text, files)
    expect(problems).toEqual([])
    expect(JSON.stringify(react(tree))).toContain('"fcode"')
  })

  it('names the line it is written on when its source is not found', () => {
    const text = '=begin pod\n=begin React\n=para before\n\n=include file:missing.podlite\n=end React\n=end pod\n'
    const { problems } = assembled(text, files)
    expect(problems.map(problem => [problem.kind, problem.chain[0].location?.start.line])).toEqual([['source', 5]])
  })

  it('finds a block of the body of an included file by a selector', () => {
    const { tree, problems } = assembled('=begin pod\n=include file:holder.podlite | para\n=end pod\n', files)
    expect(problems).toEqual([])
    expect(texts(tree).filter(text => text.includes('in the body')).length).toBe(1)
  })

  it('reads the body of an included file with the settings at the directive', () => {
    const text = '=begin pod\n=config code :allow<B>\n\n=include file:holder.podlite\n=end pod\n'
    const { tree, problems } = assembled(text, files)
    expect(problems).toEqual([])
    expect(JSON.stringify(react(tree))).toContain('"fcode"')
  })

  it('reads an operand with no source from the blocks of a body of its document', () => {
    const text =
      '=begin pod\n=begin React\n=defn draft\nNot final.\n=end React\n\n=include file:guide.podlite | Invoice[ :type(in | defn) ]\n=end pod\n'
    const guide = '=begin pod\n=for Invoice :type<draft>\nA\n\n=for Invoice :type<paid>\nB\n=end pod\n'
    const { tree, problems } = assembled(text, { '/lib/guide.podlite': guide })
    expect(problems).toEqual([])
    expect(count('Invoice', tree)).toBe(1)
  })

  it('keeps apart two blocks of a body written alike when its file is read twice', () => {
    const twice = '=begin pod\n=begin React\n=para same\n\n=para same\n\n=para other\n=end React\n=end pod\n'
    const text = '=begin pod\n=config para :mark<1>\n\n=include file:twice.podlite | para\n=end pod\n'
    const { tree, problems } = assembled(text, { '/lib/twice.podlite': twice })
    expect(problems).toEqual([])
    expect(texts(tree).filter(text => text.includes('same')).length).toBe(2)
    expect(texts(tree).filter(text => text.includes('other')).length).toBe(1)
  })
})

describe('includes written alike in bodies, with a provider that answers later', () => {
  const found: Located = { masked: false, sources: [{ id: '/lib/x.podlite', name: 'x.podlite', context: '/lib' }] }
  const assembledLater = async (text: string) => {
    // the lines of the directives the provider was asked about
    const asked: number[] = []
    const sources: AsyncSources = {
      locate: (_path, _context, _plain, at?: IncludeStep) =>
        new Promise<Located>(resolve => {
          const line = at?.location?.start.line
          if (line) asked.push(line)
          setTimeout(() => resolve(found), 1)
        }),
      read: () => Promise.resolve('=begin pod\n=para brought\n=end pod\n'),
    }
    const problems: IncludeProblem[] = []
    const tree = await assembleAsync(read(text, main), {
      sources,
      context: '/lib',
      file: main,
      text,
      parse: read,
      onError: problem => problems.push(problem),
      onWarning: problem => problems.push(problem),
    })
    return { tree, problems, asked }
  }
  const brought = (tree: any): number => texts(tree).filter(text => text.includes('brought')).length

  it('are asked about each by its own place in one body, indented and with a blank line between them', async () => {
    const text =
      '=begin pod\n  =begin React\n  =include file:x.podlite\n\n  =include file:x.podlite\n  =end React\n=end pod\n'
    const { tree, problems, asked } = await assembledLater(text)
    expect(problems).toEqual([])
    expect([...new Set(asked)].sort()).toEqual([3, 5])
    expect(brought(tree)).toBe(2)
  })

  it('are asked about each by its own place in two bodies', async () => {
    const text =
      '=begin pod\n=begin React\n=include file:x.podlite\n=end React\n\n=begin React\n=include file:x.podlite\n=end React\n=end pod\n'
    const { tree, problems, asked } = await assembledLater(text)
    expect(problems).toEqual([])
    expect([...new Set(asked)].sort()).toEqual([3, 7])
    expect(brought(tree)).toBe(2)
  })
})
