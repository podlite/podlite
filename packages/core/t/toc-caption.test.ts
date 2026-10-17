import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { markGuarded, mkCaption, mkToc, mkTocList, toAnyRules, toHtml } from '@podlite/schema'
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

const html = (source: string): string =>
  String(toHtml({ renderMode: 'production' }).use(toAnyRules('toHtml', p.getPlugins())).run(parseToAst(source)))

const tocsOf = (node: unknown): Found[] => {
  if (Array.isArray(node)) return node.flatMap(tocsOf)
  const own = record(node)
  if (!own) return []
  return own.type === 'toc' ? [own] : tocsOf(own.content)
}

const textOf = (node: unknown): string => {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(textOf).join('')
  const own = record(node)
  if (!own) return ''
  return own.type === 'text' ? String(own.value) : textOf(own.content)
}

// the text of each entry of the last table of contents in the document
const entriesOf = (source: string): string[] => {
  const tocs = tocsOf(parseToAst(source))
  const list = record(tocs[tocs.length - 1]?.content)
  const items = Array.isArray(list?.content) ? list.content : []
  return items.map(item => textOf(record(item)?.content))
}

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

  it('is not taken from :title', () => {
    const source = '=for toc :title<LEGACY>\nhead1\n\n=head1 One\n'
    const toc = tocOf(source)
    expect(toc).not.toHaveProperty('caption')
    expect(toc?.title).toBeUndefined()
    expect(html(source)).not.toContain('toctitle')
  })

  it('is not taken from :title when :caption is empty', () => {
    const source = "=for toc :caption('') :title<LEGACY>\nhead1\n\n=head1 One\n"
    expect(tocOf(source)).not.toHaveProperty('caption')
    expect(html(source)).not.toContain('toctitle')
  })

  it('comes from :caption when :title is written beside it', () => {
    expect(wordsOf(tocOf('=for toc :caption<CAP> :title<LEGACY>\nhead1\n\n=head1 One\n')?.caption)).toEqual([
      ['CAP', false],
    ])
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

describe('an entry for a block that a table of contents lists', () => {
  it('is not named by the :title of a table of contents', () => {
    const entries = entriesOf('=for toc :id<inner> :title<LEGACY>\nhead1\n\n=toc toc[ :id<inner> ]\n\n=head1 One\n')
    expect(entries).toHaveLength(1)
    expect(entries[0]).not.toContain('LEGACY')
    // the listed table still holds its selector when the entries are made, so its text is the selector
    expect(entries[0].trim()).toBe('head1')
  })

  it('is not named by the :title of a table of contents written Toc', () => {
    // Toc is the older spelling the module still reads, not a name of the specification
    const entries = entriesOf(
      '=for Toc :id<inner> :title<LEGACY>\nhead1\n\n=for Toc\nToc[ :id<inner> ]\n\n=head1 One\n',
    )
    expect(entries).toEqual(['Toc not have :caption'])
  })

  it('is still named by the :title of another block', () => {
    expect(entriesOf('=for Diagram :id<d> :title<Flow>\ngraph LR\n\n=toc Diagram\n')).toEqual(['Flow'])
    expect(entriesOf('=for nested :id<n> :title<Quoted>\nText\n\n=toc nested\n')).toEqual(['Quoted'])
  })
})
