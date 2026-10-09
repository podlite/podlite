import * as path from 'path'
import { bindTarget, buildBindingIndex, getFromTree, getTextContentFromNode, PodNode } from '@podlite/schema'
import { processPlugin, publishRecord } from '../src'
import { processFile } from '../src/node'
import resolvePlugin, { includePasses } from '../src/include-resolve-plugin'
import imagesPlugin from '../src/images-plugin'
import linksPlugin, { LinkError } from '../src/links-plugin'
import reactPlugin from '../src/react-plugin'
import siteDataPlugin, { SITE_DATA_DOCUMENT } from '../src/site-data-plugin'
import { podlite } from 'podlite'

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

  it('goes to the address a section of the document was given by :id', () => {
    const target = processFile(
      'site/t.podlite',
      '=begin pod :puburl</t>\n=for NAME :id<Name>\nThe name\n\n=for head1 :id<custom>\nSome section\n=end pod\n',
    )
    const host = processFile(
      'site/host.podlite',
      '=begin pod\nSee L<doc:Name#Some section> and L<doc:Name#custom>.\n=end pod\n',
    )
    const [res] = processPlugin({ plugin: linksPlugin(), includePatterns: '.*' }, [host, target], tctx)
    expect(links(res[0].node)).toEqual(['/t#custom', '/t#custom'])
  })

  it('stops the build on a section the document does not have, and on a document without an address', () => {
    const target = processFile('site/t.podlite', '=begin pod :puburl</t>\n=for NAME :id<Name>\nThe name\n=end pod\n')
    const unpublished = processFile('site/u.podlite', '=begin pod\n=for NAME :id<Draft>\nThe draft\n=end pod\n')
    const host = processFile(
      'site/host.podlite',
      '=begin pod\nSee L<doc:Name#Absent>.\n\nAnd L<doc:Draft#Part>.\n=end pod\n',
    )
    expect(run([host, target, unpublished])).toEqual([
      'site/host.podlite:2: a link in the text from this line, doc:Name#Absent: Name has no section Absent',
      'site/host.podlite:4: a link in the text from this line, doc:Draft#Part: no published document is named Draft',
    ])
  })

  it('goes to the page itself for a section the document is named by', () => {
    const target = processFile(
      'site/t.podlite',
      '=begin pod :puburl</t>\n=for NAME :id<Name>\nThe name\n\n=for TITLE :id<Target>\nTitle\n=end pod\n',
    )
    const host = processFile('site/host.podlite', '=begin pod\nSee L<doc:Name#Target>.\n=end pod\n')
    const [res] = processPlugin({ plugin: linksPlugin(), includePatterns: '.*' }, [host, target], tctx)
    expect(links(res[0].node)).toEqual(['/t'])
  })

  it('goes to the home page, whose address the site gives later', () => {
    const index = processFile('site/index.pod6', '=begin pod\n=for TITLE :id<Home>\nSite\n\n=head1 About\n=end pod\n')
    const host = processFile(
      'site/host.podlite',
      '=begin pod :puburl</h>\nSee L<doc:Home> and L<doc:Home#About>.\n=end pod\n',
    )
    const plugin = linksPlugin({ home: 'site/index.pod6' })
    const [res] = processPlugin({ plugin, includePatterns: '.*' }, [host, index], tctx)
    expect(links(res[0].node)).toEqual(['/', '/#About'])
  })

  it('goes to a section of its own page when the name is left out', () => {
    const page = processFile(
      'site/a.podlite',
      '=begin pod :puburl</a>\n=TITLE A\n\n=head1 Here\n\nSee L<doc:#Here>.\n=end pod\n',
    )
    const [res] = processPlugin({ plugin: linksPlugin(), includePatterns: '.*' }, [page], tctx)
    expect(links(res[0].node)).toEqual(['#Here'])
    expect(run([processFile('site/b.podlite', '=begin pod :puburl</b>\nSee L<doc:#Absent>.\n=end pod\n')])).toEqual([
      'site/b.podlite:2: a link in the text from this line, doc:#Absent: the page has no section Absent',
    ])
  })

  it('does not take a name an include brought for the name of the including document', () => {
    const source = processFile('site/source.podlite', '=begin pod :puburl</source>\n=TITLE Source\n=end pod\n')
    const host = processFile(
      'site/host.podlite',
      '=begin pod :puburl</host>\n=TITLE Host\n\n=include file:./source.podlite\n\nSee L<doc:Source>.\n=end pod\n',
    )
    const records = quietly(() => resolvePlugin({ catalogue: [source, host] })[0]([source, host]))
    const [, res] = processPlugin({ plugin: linksPlugin(), includePatterns: '.*' }, records, tctx)[0]
    expect(links(res.node)).toEqual(['/source'])
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

  it('leaves the table of contents link to a heading that holds a doc: link a link to the heading', () => {
    const target = processFile('site/target.pod6', '=begin pod :puburl</target>\n=TITLE Target\n=end pod\n')
    const host = processFile(
      'site/host.pod6',
      '=begin pod :puburl</host>\n=TITLE Host\n\n=toc head1\n\n=head1 Using L<doc:Target> in practice\n\nText.\n=end pod\n',
    )
    const records = quietly(() => includePasses({ catalogue: [target, host] }).first[0]([target, host]))
    const [res] = processPlugin({ plugin: linksPlugin(), includePatterns: '.*' }, records, tctx)
    expect(links(res[1].node)).toEqual(['#Using doc:Target in practice', '/target'])
  })

  it('does not read a link to another scheme with doc: in its address as a doc: link', () => {
    const host = processFile('site/host.pod6', '=begin pod\n=para L<https://example.org/doc:Missing>\n=end pod\n')
    expect(run([host])).toEqual([])
  })

  it('keeps the address of a link to another scheme with file: in it', () => {
    const host = processFile(
      'site/host.pod6',
      '=begin pod :puburl</host>\n=para L<x|https://example.org/file:x>\n=end pod\n',
    )
    const [res] = processPlugin({ plugin: linksPlugin(), includePatterns: '.*' }, [host], tctx)
    expect(links(res[0].node)).toEqual(['https://example.org/file:x'])
  })
})

describe('a doc: link that does not resolve, when the site asks for warnings', () => {
  // the plugin and what it printed, with the console kept quiet
  const warned = (records: publishRecord[]) => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const [res, ctx] = processPlugin(
        { plugin: linksPlugin({ unresolved: 'warning' }), includePatterns: '.*' },
        records,
        tctx,
      )
      return { res, ctx, printed: warn.mock.calls.map(call => call.join(' ')) }
    } finally {
      warn.mockRestore()
    }
  }
  const words = (node: unknown): string => getTextContentFromNode(node as PodNode)

  it('lets the build go on and names every link in one warning', () => {
    const target = processFile('site/t.podlite', '=begin pod :puburl</t>\n=for NAME :id<Name>\nThe name\n=end pod\n')
    const host = processFile(
      'site/host.podlite',
      '=begin pod\nSee L<doc:Absent> and L<doc:Absent>.\n\nAnd L<doc:Name#Part>.\n\nAnd L<doc:#Here>.\n=end pod\n',
    )
    const { ctx, printed } = warned([host, target])
    const lines = [
      'site/host.podlite:2: a link in the text from this line, doc:Absent: no published document is named Absent',
      'site/host.podlite:4: a link in the text from this line, doc:Name#Part: Name has no section Part',
      'site/host.podlite:6: a link in the text from this line, doc:#Here: the page has no section Here',
    ]
    expect(printed).toEqual([`[links] a link does not resolve:\n${lines.map(line => `  ${line}`).join('\n')}`])
    expect(ctx.unresolvedLinks).toEqual(lines)
  })

  it('names two documents that answer to the name, and links to neither', () => {
    const records = [
      processFile('a/one.pod6', '=begin pod :puburl</one>\n=TITLE Same\n=end pod\n'),
      processFile('b/two.pod6', '=begin pod :puburl</two>\n=TITLE Same\n=end pod\n'),
      processFile('site/page.pod6', '=begin pod :puburl</page>\n=para L<doc:Same>\n=end pod\n'),
    ]
    const { res, ctx } = warned(records)
    expect(ctx.unresolvedLinks).toEqual([
      'site/page.pod6:2: a link in the text from this line, doc:Same: more than one document is named Same: a/one.pod6, b/two.pod6',
    ])
    expect(links(res[2].node)).toEqual([])
  })

  it('writes a link with its own text as that text, formatting kept', () => {
    const host = processFile('site/host.podlite', '=begin pod\nSee L<the B<manual>|doc:Missing> now.\n=end pod\n')
    const { res } = warned([host])
    expect(links(res[0].node)).toEqual([])
    expect(getFromTree(res[0].node, 'B').map(words)).toEqual(['manual'])
    expect(words(res[0].node)).toContain('See the manual now.')
  })

  it('writes a link without text of its own as what follows doc:', () => {
    const host = processFile(
      'site/host.podlite',
      '=begin pod\nSee L<doc:Test::Async::Manual>, L<doc:Name#Part> and L<doc:#Here>.\n=end pod\n',
    )
    const { res } = warned([host])
    expect(links(res[0].node)).toEqual([])
    expect(words(res[0].node)).toContain('See Test::Async::Manual, Name#Part and #Here.')
  })

  it('writes the link as text in the description, the header and the footer of a record', () => {
    const record = processFile('site/host.podlite', '=begin pod\n=DESCRIPTION See L<doc:Missing>.\n=end pod\n')
    const extra = processFile('site/extra.podlite', '=begin pod\nOn L<doc:Missing>.\n=end pod\n').node
    const { res } = warned([{ ...record, header: extra, footer: extra }])
    expect(words(res[0].description).trim()).toBe('See Missing.')
    expect(links(res[0].header)).toEqual([])
    expect(words(res[0].header)).toContain('On Missing.')
    expect(words(res[0].footer)).toContain('On Missing.')
  })

  it('keeps the words of a hidden link hidden', () => {
    const host = processFile('site/host.podlite', '=begin pod\n=for para :masked\nSee L<doc:Missing>.\n=end pod\n')
    const { res } = warned([host])
    const text = getFromTree(res[0].node, (n: any) => n.type === 'text' && n.value === 'Missing') as any[]
    expect(text.map(n => n.guarded)).toEqual([true])
  })

  it('takes doc: off the address when a code holds it', () => {
    const host = processFile('site/host.podlite', '=begin pod\nSee L<B<doc:Missing>> now.\n=end pod\n')
    const { res } = warned([host])
    expect(links(res[0].node)).toEqual([])
    expect(getFromTree(res[0].node, 'B').map(words)).toEqual(['Missing'])
  })

  it('takes doc: off the address when its letters are spread over codes', () => {
    const host = processFile(
      'site/host.podlite',
      '=begin pod\nSee L<doB<c:>Missing> and L<B< >doc:Other> now.\n=end pod\n',
    )
    const { res } = warned([host])
    expect(links(res[0].node)).toEqual([])
    expect(words(res[0].node)).toContain('See Missing and Other now.')
  })

  it('keeps hidden the words a link without text of its own hides in its address', () => {
    const host = processFile('site/host.podlite', '=begin pod\nSee L<doc:G<Secret>> now.\n=end pod\n')
    const { res } = warned([host])
    expect(links(res[0].node)).toEqual([])
    expect(getFromTree(res[0].node, 'G').map(words)).toEqual(['Secret'])
    const text = getFromTree(res[0].node, (n: any) => n.type === 'text' && n.value === 'Secret') as any[]
    expect(text.map(n => n.guarded)).toEqual([true])
  })

  it('keeps the table of contents link written for a heading whose doc: link does not resolve', () => {
    const host = processFile(
      'site/host.pod6',
      '=begin pod :puburl</host>\n=TITLE Host\n\n=toc head1\n\n=head1 Using L<doc:Missing> in practice\n\nText.\n=end pod\n',
    )
    const records = quietly(() => includePasses({ catalogue: [host] }).first[0]([host]))
    const { res } = warned(records)
    expect(links(res[0].node)).toEqual(['#Using doc:Missing in practice'])
  })

  it('prints nothing when every link resolves', () => {
    const target = processFile('site/t.podlite', '=begin pod :puburl</t>\n=TITLE Target\n=end pod\n')
    const host = processFile('site/host.podlite', '=begin pod\nSee L<doc:Target>.\n=end pod\n')
    const { res, ctx, printed } = warned([host, target])
    expect(printed).toEqual([])
    expect(ctx.unresolvedLinks).toEqual([])
    expect(links(res[0].node)).toEqual(['/t'])
  })

  it('clears the list of a call before when the next call has no problems', () => {
    const plugin = linksPlugin({ unresolved: 'warning' })
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const broken = processFile('site/host.podlite', '=begin pod\nSee L<doc:Absent>.\n=end pod\n')
      const clean = processFile('site/clean.podlite', '=begin pod\nNo links.\n=end pod\n')
      processPlugin({ plugin, includePatterns: '.*' }, [broken], tctx)
      const [, ctx] = processPlugin({ plugin, includePatterns: '.*' }, [clean], tctx)
      expect(ctx.unresolvedLinks).toEqual([])
    } finally {
      warn.mockRestore()
    }
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
      processFile('site/contents.podlite', `=begin pod\n=include doc:${SITE_DATA_DOCUMENT}#articles\n=end pod\n`),
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
        [items[0], items[1], items[3]],
      ),
    )
    const store = res.find(r => r.file === 'virtual/site-data-plugin.podlite')!
    const [data] = getFromTree(store.node, 'data').map(n => String(getTextContentFromNode(n as PodNode)))
    expect(data).toContain('parts_a_png')
    expect(data).not.toContain('"./a.png"')
    // the last pass places what the site data plugin made in the page that includes it
    const contents = res.find(r => r.file === 'site/contents.podlite')!
    expect(getFromTree(contents.node, 'include')).toHaveLength(0)
    expect(getFromTree(contents.node, 'data').map(n => String(getTextContentFromNode(n as PodNode)))).toEqual([data])
  })
})

describe('a table of contents entry for a heading that holds a doc: link', () => {
  // the table of contents is built before the links plugin changes the heading's text
  const entriesReach = (records: publishRecord[], options = {}) => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const [res] = processPlugin({ plugin: linksPlugin(options), includePatterns: '.*' }, records, tctx)
      const host = res.find(record => record.file === 'site/host.podlite')!
      const index = buildBindingIndex(host.node)
      const heads = getFromTree(host.node, 'head')
      const links = getFromTree(host.node, 'L').filter((link: any) => String(link.meta).startsWith('#'))
      // and on the page: the entry's address against the heading's anchor
      const html = String(podlite({ importPlugins: true }).toHtml(host.node))
      const entries = [...html.matchAll(/<li class="toc-item"><p><a([^>]*)>/g)].map(
        m => (m[1].match(/href="([^"]*)"/) || [])[1],
      )
      const anchors = [...html.matchAll(/<h1 id="([^"]*)"/g)].map(m => `#${m[1]}`)
      return { heads, reached: links.map((link: any) => bindTarget(link.meta.slice(1), index)), entries, anchors }
    } finally {
      warn.mockRestore()
    }
  }
  const target = () => processFile('site/target.podlite', '=begin pod :puburl</target>\n=TITLE Target\n=end pod\n')

  it('reaches the heading when the link resolves', () => {
    const host = processFile(
      'site/host.podlite',
      '=begin pod\n=toc head1\n\n=head1 About L<doc:Target> here\n\nA.\n=end pod\n',
    )
    const { heads, reached, entries, anchors } = entriesReach([target(), host])
    expect(reached).toHaveLength(1)
    expect(reached[0].found && reached[0].node).toBe(heads[0])
    expect(entries).toEqual(anchors)
  })

  it('reaches the heading when the link does not resolve and the site asks for warnings', () => {
    const host = processFile(
      'site/host.podlite',
      '=begin pod\n=toc head1\n\n=head1 Using L<doc:Missing> in practice\n\nA.\n=end pod\n',
    )
    const { heads, reached, entries, anchors } = entriesReach([target(), host], { unresolved: 'warning' })
    expect(reached).toHaveLength(1)
    expect(reached[0].found && reached[0].node).toBe(heads[0])
    expect(entries).toEqual(anchors)
  })
})
