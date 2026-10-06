import * as path from 'path'
import { getFromTree, getTextContentFromNode, PodNode } from '@podlite/schema'
import { processPlugin, publishRecord } from '../src'
import { processFile } from '../src/node'
import resolvePlugin, { includePasses } from '../src/include-resolve-plugin'
import imagesPlugin from '../src/images-plugin'
import linksPlugin, { LinkError } from '../src/links-plugin'
import reactPlugin from '../src/react-plugin'
import siteDataPlugin from '../src/site-data-plugin'

const tctx = { testing: true }

const quietly = <T>(fn: () => T): T => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    return fn()
  } finally {
    warn.mockRestore()
  }
}

const assembled = (records: publishRecord[], catalogue: publishRecord[] = records) =>
  quietly(() => resolvePlugin({ catalogue })[0](records))

const links = (node: unknown): string[] =>
  (getFromTree(node as PodNode, (n: any) => n.type === 'fcode' && n.name === 'L') as any[]).map(l => l.meta)

// a mark a plugin puts on the pod block of a record, as the versions of a site do
const noindex = (record: publishRecord, publishUrl: string): publishRecord => ({
  ...record,
  publishUrl,
  node: {
    ...(record.node as any),
    content: (record.node as any).content.map((n: any) =>
      n.name === 'pod' ? { ...n, config: [...(n.config || []), { name: 'noindex', value: true, type: 'boolean' }] } : n,
    ),
  },
})

const chapter = [
  processFile(
    'site/book.podlite',
    '=begin pod :puburl<book>\n=TITLE Book\n\n=include file:./ch/one.podlite\n=end pod\n',
  ),
  processFile(
    'site/ch/one.podlite',
    "=begin pod\n=useReact {Chart} from './chart.tsx'\n\n=picture ./img/a.png\n\nSee L<two|file:./two.podlite>.\n=end pod\n",
  ),
  processFile('site/ch/two.podlite', '=begin pod :puburl<two>\n=TITLE Two\n=end pod\n'),
]

describe('paths in a chapter an include brought', () => {
  it('find a picture from the directory of the chapter', () => {
    const [book] = assembled([chapter[0]], chapter)
    const [, ctx] = processPlugin({ plugin: imagesPlugin(), includePatterns: '.*' }, [book], tctx)
    expect(Object.keys(ctx.imagesMap)).toEqual([path.resolve('site/ch/img/a.png')])
  })

  it('find a link from the directory of the chapter', () => {
    const [book] = assembled([chapter[0]], chapter)
    const [res] = processPlugin({ plugin: linksPlugin(), includePatterns: '.*' }, [book, chapter[2]], tctx)
    expect(links(res[0].node)).toEqual(['two'])
  })

  it('find a component from the directory of the chapter', () => {
    const [book] = assembled([chapter[0]], chapter)
    const [, ctx] = processPlugin({ plugin: reactPlugin(), includePatterns: '.*' }, [book], tctx)
    expect(Object.keys(ctx.componensMap)).toEqual([path.resolve('site/ch/chart.tsx')])
  })
})

describe('a link to a file placed in versions', () => {
  const v2 = processFile('mounts/v2/Spec.pod6', '=begin pod :puburl</v2.0/spec>\n=TITLE Spec two\n=end pod\n')
  const guide = processFile(
    'mounts/v2/guide.pod6',
    '=begin pod :puburl</v2.0/guide>\n=para L<spec|file:./Spec.pod6>\n=end pod\n',
  )
  const v3 = processFile('mounts/v3/Spec.pod6', '=begin pod :puburl</spec>\n=TITLE Spec three\n=end pod\n')
  const page = processFile(
    'site/page.pod6',
    '=begin pod :puburl</page>\n=para L<spec|file:../mounts/v3/Spec.pod6> L<doc:Spec three>\n=end pod\n',
  )
  const run = (records: publishRecord[]) =>
    processPlugin({ plugin: linksPlugin(), includePatterns: '.*' }, records, tctx)[0]

  it('goes to the address of its own version', () => {
    const res = run([v2, guide, v3, noindex(v3, '/v3.0/spec')])
    expect(links(res[1].node)).toEqual(['/v2.0/spec'])
  })

  it('goes to the address of the current version that is indexed, not to its permanent one', () => {
    for (const records of [
      [v3, noindex(v3, '/v3.0/spec'), page],
      [noindex(v3, '/v3.0/spec'), v3, page],
    ]) {
      const res = run(records)
      expect(links(res[2].node)).toEqual(['/spec', '/spec'])
    }
  })
})

describe('a doc: link', () => {
  const run = (records: publishRecord[], documents?: (name: string) => string[]): string[] => {
    try {
      processPlugin({ plugin: linksPlugin({ documents }), includePatterns: '.*' }, records, tctx)
    } catch (e) {
      if (e instanceof LinkError) return e.problems
      throw e
    }
    return []
  }
  const page = processFile('site/page.pod6', '=begin pod :puburl</page>\n=para L<doc:Same>\n=end pod\n')

  it('stops the build when two documents answer to the name', () => {
    const records = [
      processFile('a/one.pod6', '=begin pod :puburl</one>\n=TITLE Same\n=end pod\n'),
      processFile('b/two.pod6', '=begin pod :puburl</two>\n=TITLE Same\n=end pod\n'),
      page,
    ]
    expect(run(records)).toEqual([
      'site/page.pod6:2: a link in the text from this line, doc:Same: more than one document is named Same: a/one.pod6, b/two.pod6',
    ])
  })

  it('stops the build when no published document answers to it', () => {
    expect(run([page])).toEqual([
      'site/page.pod6:2: a link in the text from this line, doc:Same: no published document is named Same',
    ])
  })

  it('goes to a section of the document named after the name', () => {
    const target = processFile(
      'site/t.podlite',
      '=begin pod :puburl</t>\n=for NAME :id<Name>\nThe name\n\n=head1 Some section\n=end pod\n',
    )
    const host = processFile('site/host.podlite', '=begin pod\nIntro.\n\nSee L<doc:Name#Some section>.\n=end pod\n')
    const [res] = processPlugin({ plugin: linksPlugin(), includePatterns: '.*' }, [host, target], tctx)
    expect(links(res[0].node)).toEqual(['/t#Some-section'])
  })

  it('names the line of the paragraph that holds the link', () => {
    const host = processFile('site/host.podlite', '=begin pod\nIntro.\n\nSee L<doc:Absent>.\n=end pod\n')
    expect(run([host])).toEqual([
      'site/host.podlite:4: a link in the text from this line, doc:Absent: no published document is named Absent',
    ])
  })

  it('takes the names the include plugin finds documents by', () => {
    const one = processFile('a/one.pod6', '=begin pod :puburl</one>\n=TITLE Same\n=end pod\n')
    // a document of the site that is not published answers to the name too
    const hidden = processFile('b/hidden.pod6', '=begin pod\n=TITLE Same\n=end pod\n')
    const { documents } = includePasses({ catalogue: [one, hidden, page] })
    expect(run([one, page])).toEqual([])
    expect(run([one, page], documents)).toEqual([
      'site/page.pod6:2: a link in the text from this line, doc:Same: more than one document is named Same: a/one.pod6, b/hidden.pod6',
    ])
  })
})

describe('the site data', () => {
  it('holds a picture of an included fragment of an article as the images plugin made it', () => {
    const items = [
      processFile('site/index.podlite', '=begin pod\n=TITLE Index\n=end pod\n'),
      processFile(
        'site/post.podlite',
        '=begin pod :pubdate<2026-10-01> :puburl<post>\n=TITLE Post\n\n=include file:./parts/fig.podlite\n=end pod\n',
      ),
      processFile('site/parts/fig.podlite', '=begin pod\n=picture ./a.png\n=end pod\n'),
    ]
    const { first, last } = includePasses({ catalogue: items })
    const chain = [
      first,
      imagesPlugin(),
      siteDataPlugin({
        indexFilePath: 'site/index.podlite',
        built_path: '/built',
        public_path: '/public',
        site_url: '',
      }),
      last,
    ]
    const res = quietly(() =>
      chain.reduce(
        (recs, plugin) => processPlugin({ plugin, includePatterns: '.*' }, recs, tctx)[0],
        items.slice(0, 2),
      ),
    )
    const store = res.find(r => r.file === 'virtual/site-data-plugin.podlite')!
    const [data] = getFromTree(store.node, 'data').map(n => String(getTextContentFromNode(n as PodNode)))
    expect(data).toContain('parts_a_png')
    expect(data).not.toContain('"./a.png"')
  })
})
