import { toHtml, buildBindingIndex, bindTarget } from '@podlite/schema'
import { podlite, readerFor } from '../src'
import { assembleIncludes, sourcesFromFiles } from '../src/assemble'

// Specification.pod6, Include directive: a block included from the same document stands
// beside the block it copies, so each has an id of its own

const read = readerFor(podlite({ importPlugins: true }))
const assembled = (text: string) =>
  assembleIncludes(read(text, 'main.podlite'), {
    sources: sourcesFromFiles({}),
    context: '',
    file: 'main.podlite',
    text,
    parse: read,
    tolerant: true,
  })
const blocks = (tree: any): any[] => {
  const out: any[] = []
  const walk = (node: any) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== 'object') return
    if (node.type === 'block' && node.name !== 'root') out.push(node)
    walk(node.content)
  }
  walk(tree)
  return out
}
const ids = (text: string) => blocks(assembled(text)).map(block => block.id)

describe('the id of a block included from the same document', () => {
  it('is made from the id of the block it copies, one for each copy', () => {
    const [one, copy] = ids('=para One\n\n=include para\n')
    expect(copy).toBe(`${one}-1`)
    const [first, second, third] = ids('=para One\n\n=include para\n\n=include para\n')
    expect([second, third]).toEqual([`${first}-1`, `${first}-2`])
  })

  it('is given to a copy placed before the block too, and to the blocks inside a copy', () => {
    const [copy, one] = ids('=include para\n\n=para One\n')
    expect(copy).toBe(`${one}-1`)
    const [quote, para, quoteCopy, paraCopy] = ids('=begin nested\n=para One\n=end nested\n\n=include nested\n')
    expect([quoteCopy, paraCopy]).toEqual([`${quote}-1`, `${para}-1`])
  })

  it('writes two titles with ids of their own and binds each to its own place', () => {
    const tree = assembled('=TITLE Name\n\n=include TITLE\n')
    const [title, copy] = blocks(tree)
    expect(copy.id).toBe(`${title.id}-1`)
    // the output shapes an id into an anchor, so it is read back from the output
    const html = String(toHtml({}).run(tree))
    const anchors = [...html.matchAll(/<h1 class="TITLE" id="([^"]+)">/g)].map(match => match[1])
    expect(anchors).toHaveLength(2)
    expect(new Set(anchors).size).toBe(2)
    const bindings = buildBindingIndex(tree)
    expect(bindTarget(title.id, bindings)).toMatchObject({ found: true, node: title, ambiguous: false })
    expect(bindTarget(copy.id, bindings)).toMatchObject({ found: true, node: copy, ambiguous: false })
  })
})

describe('a copy and its marks', () => {
  it('keeps the place and the configuration of the block, and tells a host its final id', () => {
    const text = '=for para :id<p>\nOne\n\n=include para\n'
    const seen: Array<[string, string]> = []
    const tree = assembleIncludes(read(text, 'main.podlite'), {
      sources: sourcesFromFiles({}),
      context: '',
      file: 'main.podlite',
      text,
      parse: read,
      tolerant: true,
      onCopy: (from: any, to: any) => {
        if (from.type === 'block') seen.push([from.id, to.id])
      },
    })
    const [one, copy] = blocks(tree)
    expect(copy.location).toEqual(one.location)
    expect(copy.config).toEqual(one.config)
    expect(seen).toContainEqual([one.id, copy.id])
  })
})

describe('what stays as it was', () => {
  it('keeps the address of a heading and the id the author wrote', () => {
    expect(String(toHtml({}).run(assembled('=head1 Name\n\n=include head1\n')))).toBe(
      '<h1 id="Name">Name\n</h1><h1 id="Name-2">Name\n</h1>',
    )
    expect(String(toHtml({}).run(assembled('=for para :id<p>\nOne\n\n=include para\n')))).toBe(
      '<p id="p">One\n</p><p id="p">One\n</p>',
    )
  })
})
