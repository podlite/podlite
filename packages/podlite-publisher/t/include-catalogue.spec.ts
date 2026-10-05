import { getFromTree, getNodeId, getTextContentFromNode, makeAttrs, PodNode } from '@podlite/schema'
import { processPlugin, publishRecord } from '../src'
import { processFile } from '../src/node'
import { recordOrigin, recordSource } from '../src/record'
import resolvePlugin from '../src/include-resolve-plugin'
import pubdatePlugin from '../src/pubdate-plugin'

const resolve = (records: publishRecord[], catalogue: publishRecord[] = records, bounds?: string[]) => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const [res] = processPlugin({ plugin: resolvePlugin({ catalogue, bounds }), includePatterns: '.*' }, records, {})
  const said = warn.mock.calls.map(c => String(c[0]))
  warn.mockRestore()
  return { res, said }
}

const texts = (node: unknown, name: string): string[] =>
  getFromTree(node as PodNode, name).map(n => String(getTextContentFromNode(n as PodNode)).trim())

// the id a para with that text carries, from its own attributes or a =config
const idOf = (node: unknown, text: string): string | undefined => {
  const para = getFromTree(node as PodNode, 'para').find(
    (n: any) => n.type === 'block' && String(getTextContentFromNode(n)).trim() === text,
  )
  return para ? getNodeId(para as PodNode, {}) : undefined
}

const caseIn = (version: string) => `=begin pod\n=for para :id<case>\nFrom ${version}\n=end pod\n`
const specOf = (title: string) => `=begin pod\n=TITLE ${title}\n\n=include file:./t/a.podlite#case\n=end pod\n`

describe('the catalogue of an include', () => {
  it('takes a test from its own version when two mounts hold the same t/', () => {
    const items = [
      processFile('mounts/v2/Specification.pod6', specOf('Spec two')),
      processFile('mounts/v2/t/a.podlite', caseIn('two')),
      processFile('mounts/v3/Specification.pod6', specOf('Spec three')),
      processFile('mounts/v3/t/a.podlite', caseIn('three')),
    ]
    const { res, said } = resolve(items)
    expect(said).toEqual([])
    expect(texts(res[0].node, 'para')).toEqual(['From two'])
    expect(texts(res[2].node, 'para')).toEqual(['From three'])
    expect(getFromTree(res[0].node, 'include')).toHaveLength(0)
  })

  it('counts the current version and its permanent address as one source', () => {
    const current = processFile('mounts/v3/Specification.pod6', specOf('Spec'))
    const permanent = { ...current, publishUrl: '/v3.0/specification' }
    const items = [current, processFile('mounts/v3/t/a.podlite', caseIn('three'))]
    const page = processFile('pages/about.podlite', '=begin pod\n=include doc:Spec | TITLE\n=end pod\n')
    const { res, said } = resolve([current, permanent, page], [...items, permanent, page])
    expect(recordSource(permanent)).toBe(recordSource(current))
    expect(said).toEqual([])
    expect(texts(res[0].node, 'para')).toEqual(['From three'])
    expect(texts(res[1].node, 'para')).toEqual(['From three'])
    expect(texts(res[2].node, 'TITLE')).toEqual(['Spec'])
  })

  it('assembles a page the pubdate plugin cut out of a file, which has no text of its own', () => {
    const file = processFile(
      'site/notes.podlite',
      '=begin pod :pubdate<2026-10-01> :puburl<notes>\n=TITLE Notes\n\n=include file:./t/a.podlite#case\n=end pod\n',
    )
    const items = [file, processFile('site/t/a.podlite', caseIn('notes'))]
    const [pages] = processPlugin({ plugin: pubdatePlugin(), includePatterns: '.*' }, items, {})
    const [page] = pages.filter(p => p.publishUrl === 'notes')
    expect(recordSource(page)).toBeUndefined()
    expect(recordOrigin(page)).toBe(recordSource(file))
    const { res, said } = resolve([page], items)
    expect(said).toEqual([])
    expect(texts(res[0].node, 'para')).toEqual(['From notes'])
  })

  it('refuses a name two documents answer to, naming both', () => {
    const items = [
      processFile('a/one.podlite', '=begin pod\n=NAME Same\n\n=para One\n=end pod\n'),
      processFile('b/two.podlite', '=begin pod\n=NAME Same\n\n=para Two\n=end pod\n'),
      processFile('pages/main.podlite', '=begin pod\n=include doc:Same | para\n=end pod\n'),
    ]
    const { res, said } = resolve(items)
    expect(said).toHaveLength(1)
    expect(said[0]).toContain('pages/main.podlite:2:')
    expect(said[0]).toContain('more than one document is named Same: a/one.podlite, b/two.podlite')
    expect(texts(res[2].node, 'para')).toEqual([])
  })

  it('does not let a path written in a mounted file lead out of its mount', () => {
    const items = [
      processFile('mounts/v3/Specification.pod6', '=begin pod\n=include file:../../site/secret.podlite\n=end pod\n'),
      processFile('site/secret.podlite', '=para Secret\n'),
      processFile('site/page.podlite', '=begin pod\n=include file:../mounts/v3/t/a.podlite#case\n=end pod\n'),
      processFile('mounts/v3/t/a.podlite', caseIn('three')),
    ]
    const { res, said } = resolve(items, items, ['mounts/v3'])
    expect(texts(res[0].node, 'para')).toEqual([])
    expect(said).toHaveLength(1)
    expect(said[0]).toContain('leads out of')
    expect(texts(res[2].node, 'para')).toEqual(['From three'])
  })
})

describe('a record an include is placed in, or brought from', () => {
  // a mark a plugin puts on the pod block of a record, as the versions of a site do
  const marked = (record: publishRecord): publishRecord => ({
    ...record,
    node: {
      ...(record.node as any),
      content: (record.node as any).content.map((n: any) =>
        n.name === 'pod'
          ? { ...n, config: [...(n.config || []), { name: 'noindex', value: true, type: 'boolean' }] }
          : n,
      ),
    },
  })
  const noindex = (node: unknown): boolean[] =>
    getFromTree(node as PodNode, 'pod').map(pod => makeAttrs(pod, {}).exists('noindex'))

  it('keeps what a plugin did to its own tree, and brings the included one as its text has it', () => {
    const part = processFile('site/part.podlite', '=begin pod\n=para Part\n=end pod\n')
    const host = processFile('site/host.podlite', '=begin pod\n=include file:./part.podlite\n=end pod\n')
    const { res, said } = resolve([marked(host), marked(part)], [host, part])
    expect(said).toEqual([])
    expect(texts(res[0].node, 'para')).toEqual(['Part'])
    expect(noindex(res[0].node)).toEqual([true, false])
  })
})

// the cases of the tests of the norm on =config through an include
describe('=config of the including file in included blocks', () => {
  const run = (host: string, files: Record<string, string>) => {
    const records = [
      processFile('site/host.podlite', host),
      ...Object.keys(files).map(f => processFile(`site/${f}`, files[f])),
    ]
    const { res, said } = resolve(records)
    expect(said).toEqual([])
    return res[0].node
  }

  it('reaches the blocks an include places after it', () => {
    const node = run('=config para :id<book>\n\n=include file:ch.podlite\n', { 'ch.podlite': '=para Included\n' })
    expect(idOf(node, 'Included')).toBe('book')
  })

  it('yields to a =config of the included file', () => {
    const node = run('=config para :id<book>\n\n=include file:ch.podlite\n', {
      'ch.podlite': '=config para :id<own>\n\n=para In\n',
    })
    expect(idOf(node, 'In')).toBe('own')
  })

  it('passes through a file to the file it includes, the nearer file first', () => {
    const node = run('=config para :id<book>\n\n=include file:part.podlite\n', {
      'part.podlite': '=config para :id<part>\n\n=include file:leaf.podlite\n',
      'leaf.podlite': '=para Leaf\n',
    })
    expect(idOf(node, 'Leaf')).toBe('part')
  })

  it('reaches a selector that reads a file with what that file includes', () => {
    const node = run('=config head1 :id<book>\n\n=include file:part.podlite | head1\n', {
      'part.podlite': '=include file:leaf.podlite\n',
      'leaf.podlite': '=head1 Leaf\n',
    })
    const [head] = getFromTree(node, 'head1').filter((n: any) => n.type === 'block')
    expect(String(getTextContentFromNode(head as PodNode)).trim()).toBe('Leaf')
    expect(getNodeId(head as PodNode, {})).toBe('book')
  })

  it('does not come from an included file to the blocks after the include', () => {
    const node = run('=include file:ch.podlite\n\n=para After\n', {
      'ch.podlite': '=config para :id<own>\n\n=para In\n',
    })
    expect(idOf(node, 'In')).toBe('own')
    expect(idOf(node, 'After')).not.toBe('own')
  })
})
