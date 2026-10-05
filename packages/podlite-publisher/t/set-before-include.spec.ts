import { getTextContentFromNode, PodNode } from '@podlite/schema'
import { PluginConfig, processPlugin } from '../src'
import { processFile } from '../src/node'
import resolvePlugin, { IncludeError } from '../src/include-resolve-plugin'

const part = `
=for NAME :id<Part>
Part

=head1 Included

Text.
`

const run = (...files: Array<[string, string]>) => {
  const state = files.map(([name, text]) => processFile(name, text))
  const config: PluginConfig = { plugin: resolvePlugin({ catalogue: state }), includePatterns: '.*' }
  const [res] = processPlugin(config, state, { testing: true })
  return { state, res }
}

const heads = (node: any, out: any[] = []): any[] => {
  if (Array.isArray(node)) {
    node.forEach(n => heads(n, out))
    return out
  }
  if (!node || typeof node !== 'object') return out
  if (node.type === 'block' && node.name === 'head') out.push(node)
  if (node.content) heads(node.content, out)
  return out
}
const idOf = (block: any) => (block?.config || []).find((c: any) => c.name === 'id')?.value
const headIds = (node: any) =>
  heads(node).map(h => [String(getTextContentFromNode(h.content as PodNode)).trim(), idOf(h)])

const quiet = () => jest.spyOn(console, 'warn').mockImplementation(() => {})

// the lines the build stops with
const stopped = (...files: Array<[string, string]>): string[] => {
  try {
    run(...files)
  } catch (e) {
    if (e instanceof IncludeError) return e.problems
    throw e
  }
  throw new Error('the build did not stop')
}

describe('=set before =include in the publisher', () => {
  it('gives the first placed block the assignment and leaves the source record unchanged', () => {
    const warn = quiet()
    const { state, res } = run(
      ['src/part.podlite', part],
      ['src/main.podlite', '=pod\n\n=set :id<chosen>\n=include doc:Part | head1\n\n=head1 After\n'],
    )
    warn.mockRestore()
    expect(headIds(res[1].node)).toEqual([
      ['Included', 'chosen'],
      ['After', undefined],
    ])
    const source = heads(state[0].node)
    expect(source.map(idOf)).toEqual([undefined])
    expect(JSON.stringify(state[0].node)).not.toContain('"guarded"')
  })

  it('gives each of two parents its own address', () => {
    const warn = quiet()
    const { res } = run(
      ['src/part.podlite', part],
      ['src/one.podlite', '=pod\n\n=set :id<one>\n=include doc:Part | head1\n'],
      ['src/two.podlite', '=pod\n\n=set :id<two>\n=include doc:Part | head1\n'],
    )
    warn.mockRestore()
    expect(headIds(res[1].node)).toEqual([['Included', 'one']])
    expect(headIds(res[2].node)).toEqual([['Included', 'two']])
    expect(headIds(res[0].node)).toEqual([['Included', undefined]])
  })

  it('stops the build when the include fails, naming the assignment it lost', () => {
    expect(stopped(['src/main.podlite', '=pod\n\n=set :id<x>\n=include doc:Absent | head1\n\n=head1 After\n'])).toEqual(
      ['src/main.podlite:4: include target not found: Absent; =set assignments not applied: id'],
    )
  })

  it('stops the build when the scheme is not one the publisher reads, and says so once', () => {
    expect(stopped(['src/main.podlite', '=pod\n\n=set :id<x>\n=include https:foo\n\n=head1 After\n'])).toEqual([
      'src/main.podlite:4: include scheme is not supported: https:; =set assignments not applied: id',
    ])
  })

  it('gives it to the first block of an include the found file holds, once that include is in', () => {
    const warn = quiet()
    const nested = `
=for NAME :id<Nested>
Nested

=include doc:Part | head1

=head1 Later
`
    const { res } = run(
      ['src/part.podlite', part],
      ['src/nested.podlite', nested],
      ['src/main.podlite', '=pod\n\n=set :id<x>\n=include doc:Nested | head1\n'],
    )
    const said = warn.mock.calls.map(c => String(c[0]))
    warn.mockRestore()
    expect(headIds(res[2].node)).toEqual([
      ['Included', 'x'],
      ['Later', undefined],
    ])
    expect(said).toEqual([])
  })

  it('passes it on to the next block when the include brings none', () => {
    const warn = quiet()
    const { res } = run(
      ['src/part.podlite', part],
      ['src/main.podlite', '=pod\n\n=set :id<chosen>\n=include doc:Part | hed1\n\n=head1 After\n'],
    )
    warn.mockRestore()
    expect(headIds(res[1].node)).toEqual([['After', 'chosen']])
  })
})
