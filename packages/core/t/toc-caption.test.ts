import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { markGuarded, mkCaption, mkToc, mkTocList } from '@podlite/schema'
import { podlite } from '../src/index'
import { resolveIncludes, IncludeOrigin } from '../src/resolve-includes'
import { refreshTocs } from '../src/refresh-tocs'

type Found = Record<string, unknown>

const p = podlite({ importPlugins: true })
const parseToAst = (source: string) => p.toAst(p.parse(source, { podMode: 1 }))

const record = (value: unknown): Found | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : undefined

const findToc = (node: unknown): Found | undefined => {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findToc(child)
      if (found) return found
    }
    return undefined
  }
  const own = record(node)
  if (!own) return undefined
  return own.type === 'toc' ? own : findToc(own.content)
}

const tocOf = (source: string): Found | undefined => findToc(parseToAst(source))

// the words of the caption with the mark each one carries
const wordsOf = (node: unknown): Array<[string, boolean]> => {
  if (Array.isArray(node)) return node.flatMap(wordsOf)
  const own = record(node)
  if (!own) return []
  if (own.type === 'text') return [[String(own.value), own.guarded === true]]
  return wordsOf(own.content)
}

const codesOf = (node: unknown): string[] => {
  if (Array.isArray(node)) return node.flatMap(codesOf)
  const own = record(node)
  if (!own) return []
  return [...(own.type === 'fcode' ? [String(own.name)] : []), ...codesOf(own.content)]
}

describe('the caption of a table of contents', () => {
  it('is parsed into a caption node next to the title', () => {
    const toc = tocOf("=for toc :caption('Public G<Secret> B<bold>')\nhead1\n\n=head1 One\n")
    expect(toc?.title).toBe('Public G<Secret> B<bold>')
    expect(toc?.caption).toMatchObject({ type: 'block', name: 'caption' })
    expect(codesOf(toc?.caption)).toEqual(['G', 'B'])
    expect(wordsOf(toc?.caption)).toEqual([
      ['Public ', false],
      ['Secret', true],
      [' ', false],
      ['bold', false],
    ])
    expect(tocOf('=for toc\nhead1\n\n=head1 One\n')).not.toHaveProperty('caption')
  })

  it('is read from :title as well', () => {
    const toc = tocOf("=for toc :title('Contents B<here>')\nhead1\n\n=head1 One\n")
    expect(codesOf(toc?.caption)).toEqual(['B'])
    expect(wordsOf(toc?.caption).map(([word]) => word)).toEqual(['Contents ', 'here'])
  })

  it('is hidden word by word when the table is hidden', () => {
    const toc = tocOf('=for toc :masked :caption<TocSecret>\nhead1\n\n=head1 One\n')
    expect(toc?.caption).toMatchObject({ guarded: true })
    expect(wordsOf(toc?.caption)).toEqual([['TocSecret', true]])
  })
})

describe('the caption of a table rebuilt after the includes', () => {
  let dir: string
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-toc-caption-'))
  })
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  // the way podlite convert builds the tree: includes first, then the tables again
  const convertTree = (body: string): unknown => {
    fs.writeFileSync(path.join(dir, 'part.podlite'), '=head1 Included\n')
    const file = path.join(dir, 'doc.podlite')
    fs.writeFileSync(file, body)
    const origin = new WeakMap<object, IncludeOrigin>()
    const tree = resolveIncludes(parseToAst(body), {
      baseDir: dir,
      parse: parseToAst,
      file,
      text: body,
      self: file,
      origin,
    })
    return refreshTocs(tree, p.parse(body, { podMode: 1 }), file, origin)
  }

  it('keeps the mark on a hidden word of the caption', () => {
    const toc = findToc(convertTree("=for toc :caption('Public G<Secret>')\nhead1\n\n=include file:part.podlite\n"))
    expect(wordsOf(toc?.caption)).toEqual([
      ['Public ', false],
      ['Secret', true],
    ])
  })

  it('keeps the caption of a hidden table hidden', () => {
    const toc = findToc(convertTree('=for toc :masked :caption<TocSecret>\nhead1\n\n=include file:part.podlite\n'))
    expect(wordsOf(toc?.caption)).toEqual([['TocSecret', true]])
  })
})

describe('marking covered content', () => {
  it('reaches a caption kept beside the content', () => {
    const toc = mkToc(
      mkTocList([], 1),
      'Plain',
      undefined,
      undefined,
      undefined,
      mkCaption([{ type: 'text', value: 'Plain' }]),
    )
    markGuarded([toc], true)
    expect(wordsOf(toc.caption)).toEqual([['Plain', true]])
  })
})
