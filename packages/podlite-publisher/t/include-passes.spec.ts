import { getFromTree, getNodeId, getTextContentFromNode, makeInterator, PodNode } from '@podlite/schema'
import { publishRecord } from '../src'
import { processFile } from '../src/node'
import { nodeOrigin } from '../src/record'
import resolvePlugin, { includePasses, IncludeError } from '../src/include-resolve-plugin'
import { SITE_DATA_DOCUMENT } from '../src/site-data-plugin'

const quietly = <T>(fn: () => T): T => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    return fn()
  } finally {
    warn.mockRestore()
  }
}

// the lines the build stops with
const stopped = (fn: () => unknown): string[] => {
  try {
    quietly(fn)
  } catch (e) {
    if (e instanceof IncludeError) return e.problems
    throw e
  }
  throw new Error('the build did not stop')
}

const only = (records: publishRecord[], catalogue: publishRecord[] = records) =>
  quietly(() => resolvePlugin({ catalogue })[0](records))

const texts = (node: unknown, name: string): string[] =>
  getFromTree(node as PodNode, name).map(n => String(getTextContentFromNode(n as PodNode)).trim())

// the document the site data plugin makes, as it makes it
const siteData = (body = '[]') =>
  processFile(
    'virtual/site-data-plugin.podlite',
    `=begin pod\n=for NAME :id<${SITE_DATA_DOCUMENT}>\nSITE DATA\n=begin data :id<articles>\n${body}\n=end data\n=end pod\n`,
  )

const contents = processFile(
  'site/contents.podlite',
  `=begin pod\n=include doc:${SITE_DATA_DOCUMENT}#articles\n=end pod\n`,
)

describe('two passes of the include plugin', () => {
  it('leaves an include of the site data in place in the first pass and places it in the last', () => {
    const { first, last } = includePasses({ catalogue: [contents] })
    const [early] = quietly(() => first[0]([contents]))
    expect(getFromTree(early.node, 'include')).toHaveLength(1)
    const [late] = quietly(() => last[0]([early, siteData('[{"title":"One"}]')]))
    expect(getFromTree(late.node, 'include')).toHaveLength(0)
    expect(texts(late.node, 'data')).toEqual(['[{"title":"One"}]'])
  })

  it('refuses in the first pass a document no plugin is declared to make', () => {
    const page = processFile('site/page.podlite', '=begin pod\n=include doc:Absent\n=end pod\n')
    const { first } = includePasses({ catalogue: [page] })
    expect(stopped(() => first[0]([page]))).toEqual(['site/page.podlite:2: include target not found: Absent'])
  })

  it('waits for a document a site names as made later', () => {
    const page = processFile('site/page.podlite', '=begin pod\n=include doc:Versions\n=end pod\n')
    const { first } = includePasses({ catalogue: [page], late: ['Versions'] })
    const [early] = quietly(() => first[0]([page]))
    expect(getFromTree(early.node, 'include')).toHaveLength(1)
  })

  it('refuses in the last pass a late document that was not made', () => {
    const { first, last } = includePasses({ catalogue: [contents] })
    const early = quietly(() => first[0]([contents]))
    expect(stopped(() => last[0](early))).toEqual([
      `site/contents.podlite:2: include target not found: ${SITE_DATA_DOCUMENT}`,
    ])
  })

  it('stops when a late document holds an include, wherever it stands in it', () => {
    const made = processFile(
      'virtual/site-data-plugin.podlite',
      `=begin pod\n=for NAME :id<${SITE_DATA_DOCUMENT}>\nSITE DATA\n=begin data :id<articles>\n[]\n=end data\n\n=include doc:Other\n=end pod\n`,
    )
    const { first, last } = includePasses({ catalogue: [contents] })
    const early = quietly(() => first[0]([contents]))
    expect(stopped(() => last[0]([...early, made]))).toEqual([
      `virtual/site-data-plugin.podlite: ${SITE_DATA_DOCUMENT} is placed after the other plugins, so it may not hold an include`,
    ])
  })

  it('stops when the last pass places a picture or a link', () => {
    const made = processFile(
      'virtual/site-data-plugin.podlite',
      `=begin pod\n=for NAME :id<${SITE_DATA_DOCUMENT}>\nSITE DATA\n\n=picture ./a.png\n\nSee L<b|file:./b.podlite>.\n=end pod\n`,
    )
    const page = processFile('site/page.podlite', `=begin pod\n=include doc:${SITE_DATA_DOCUMENT}\n=end pod\n`)
    const { first, last } = includePasses({ catalogue: [page] })
    const early = quietly(() => first[0]([page]))
    expect(stopped(() => last[0]([...early, made]))).toEqual([
      'virtual/site-data-plugin.podlite: a picture is placed after the plugins that handle it',
      'virtual/site-data-plugin.podlite: a link is placed after the plugins that handle it',
    ])
  })

  it('keeps a table of contents the first pass brought as its file built it, through the copies plugins make', () => {
    const host = processFile(
      'site/host.podlite',
      `=begin pod\n=toc head1\n\n=head1 Host\n\n=include file:./part.podlite\n\n=include doc:${SITE_DATA_DOCUMENT}#articles\n=end pod\n`,
    )
    // the table of the part stands at the place the table of the host stands in its own file
    const part = processFile('site/part.podlite', '=begin pod\n=toc head1\n\n=head1 Part\n=end pod\n')
    const { first, last } = includePasses({ catalogue: [host, part] })
    const early = quietly(() => first[0]([host]))
    // a plugin between the passes copies every node it walks
    const copied = early.map(record => ({ ...record, node: makeInterator({})(record.node, {}) }))
    const [made] = quietly(() => last[0]([...copied, siteData()]))
    const [own, brought] = getFromTree(made.node, 'toc') as any[]
    expect(JSON.stringify(own)).toContain('Host')
    expect(JSON.stringify(own)).toContain('Part')
    expect(JSON.stringify(brought)).toContain('Part')
    expect(JSON.stringify(brought)).not.toContain('Host')
  })

  it('keeps the file a block was written in when the last pass gives it a =set', () => {
    const host = processFile(
      'site/host.podlite',
      `=begin pod\n=set :id<chosen>\n=include doc:${SITE_DATA_DOCUMENT} | head1\n\n=include file:./sub/part.podlite\n=end pod\n`,
    )
    const part = processFile('site/sub/part.podlite', '=begin pod\n=para Part\n=end pod\n')
    const { first, last } = includePasses({ catalogue: [host, part] })
    const early = quietly(() => first[0]([host]))
    const [made] = quietly(() => last[0]([...early, siteData()]))
    // the next block is the pod block of the part
    const [, pod] = getFromTree(made.node, 'pod') as any[]
    expect(getNodeId(pod, {})).toBe('chosen')
    expect(nodeOrigin(pod)?.file).toBe(require('path').resolve('site/sub/part.podlite'))
  })

  it('names the file and the line of a waiting directive brought from another file', () => {
    const part = processFile(
      'site/part.podlite',
      `=begin pod\n=para Part\n\n=include doc:${SITE_DATA_DOCUMENT}#nope\n=end pod\n`,
    )
    const host = processFile('site/host.podlite', '=begin pod\n=include file:./part.podlite\n=end pod\n')
    const { first, last } = includePasses({ catalogue: [part, host] })
    const early = quietly(() => first[0]([host]))
    expect(stopped(() => last[0]([...early, siteData()]))).toEqual([
      `site/part.podlite:4: include address not found: #nope in ${SITE_DATA_DOCUMENT}`,
    ])
  })
})

describe('what stops the build', () => {
  it('names the way a failure deep inside came through', () => {
    const items = [
      processFile('site/host.podlite', '=begin pod\n=include file:./part.podlite\n=end pod\n'),
      processFile('site/part.podlite', '=begin pod\n=para Part\n\n=include file:./absent.podlite\n=end pod\n'),
    ]
    expect(stopped(() => resolvePlugin({ catalogue: items })[0]([items[0]]))).toEqual([
      'site/part.podlite:4: include target not found: ./absent.podlite (included through site/host.podlite:2)',
    ])
  })

  it('stops on two files that include each other', () => {
    const items = [
      processFile('site/a.podlite', '=begin pod\n=para A\n\n=include file:./b.podlite\n=end pod\n'),
      processFile('site/b.podlite', '=begin pod\n=para B\n\n=include file:./a.podlite\n=end pod\n'),
    ]
    const problems = stopped(() => resolvePlugin({ catalogue: items })[0](items))
    expect(problems).toEqual([
      'site/b.podlite:4: include brings nothing: ./a.podlite is already being included (included through site/a.podlite:4)',
      'site/a.podlite:4: include brings nothing: ./b.podlite is already being included (included through site/b.podlite:4)',
    ])
  })

  it('stops on a page that includes its own file', () => {
    const page = processFile('site/self.podlite', '=begin pod\n=para Self\n\n=include file:./self.podlite\n=end pod\n')
    const problems = stopped(() => resolvePlugin({ catalogue: [page] })[0]([page]))
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/^site\/self\.podlite:4: /)
  })
})

describe('the record an include places blocks in', () => {
  it('gives each page a copy of its own and leaves the included record as read', () => {
    const part = processFile('site/part.podlite', '=begin pod\n=para Part\n=end pod\n')
    const written = JSON.stringify(part.node)
    const one = processFile('site/one.podlite', '=begin pod\n=include file:./part.podlite\n=end pod\n')
    const two = processFile('site/two.podlite', '=begin pod\n=include file:./part.podlite\n=end pod\n')
    const [a, b] = only([one, two], [part, one, two])
    const [paraA] = getFromTree(a.node, 'para') as any[]
    const [paraB] = getFromTree(b.node, 'para') as any[]
    expect(paraA).not.toBe(paraB)
    paraA.content = []
    expect(texts(b.node, 'para')).toEqual(['Part'])
    expect(JSON.stringify(part.node)).toBe(written)
  })

  it('marks an included block with the file it was written in, and its own blocks with none other', () => {
    const items = [
      processFile('site/host.podlite', '=begin pod\n=para Own\n\n=include file:./sub/part.podlite\n=end pod\n'),
      processFile('site/sub/part.podlite', '=begin pod\n=para Part\n=end pod\n'),
    ]
    const [host] = only([items[0]], items)
    const files = (getFromTree(host.node, 'para') as any[]).map(p => nodeOrigin(p)?.file)
    expect(files).toEqual([items[0].file, items[1].file].map(f => require('path').resolve(f)))
    // a copy made by spreading the node keeps the mark, JSON does not carry it
    const [, part] = getFromTree(host.node, 'para') as any[]
    expect(nodeOrigin({ ...part })).toEqual(nodeOrigin(part))
    expect(JSON.stringify(part)).not.toContain('sub/part.podlite')
  })

  it('reads the body of =React in place and assembles the includes inside it', () => {
    const items = [
      processFile(
        'site/page.podlite',
        '=begin pod\n=toc head1\n\n=head1 Page\n\n=begin React :component<Box>\n=head1 In body\n\n=include file:./part.podlite\n=end React\n=end pod\n',
      ),
      processFile('site/part.podlite', '=begin pod\n=head1 Included\n=end pod\n'),
    ]
    const [react] = getFromTree(items[0].node, 'React') as any[]
    expect(texts(react, 'head1')).toEqual(['In body'])
    const [page] = only([items[0]], items)
    const [toc] = getFromTree(page.node, 'toc') as any[]
    expect(JSON.stringify(toc)).toContain('In body')
    expect(JSON.stringify(toc)).toContain('Included')
  })

  it('builds the table of contents of a page again over the body of =React when nothing is included', () => {
    const page = processFile(
      'site/page.podlite',
      '=begin pod\n=toc head1\n\n=head1 Page\n\n=begin React :component<Box>\n=head1 In body\n=end React\n=end pod\n',
    )
    const [made] = only([page])
    const [toc] = getFromTree(made.node, 'toc') as any[]
    expect(JSON.stringify(toc)).toContain('In body')
  })

  it('leaves a table of contents an include brought as its own file built it', () => {
    const items = [
      processFile('site/host.podlite', '=begin pod\n=head1 Host\n\n=include file:./part.podlite\n=end pod\n'),
      processFile('site/part.podlite', '=begin pod\n=toc head1\n\n=head1 Part\n=end pod\n'),
    ]
    const [host] = only([items[0]], items)
    const [toc] = getFromTree(host.node, 'toc') as any[]
    expect(JSON.stringify(toc)).toContain('Part')
    expect(JSON.stringify(toc)).not.toContain('Host')
  })

  it('assembles a template, a record of the chain, with its header, and the header, the footer and the description of a page', () => {
    const template = processFile(
      'site/src/template.podlite',
      '=begin pod\n=include file:./versions.podlite\n\n=begin HEADER\n=include file:./versions.podlite\n=end HEADER\n=end pod\n',
    )
    const items = [
      processFile('site/src/versions.podlite', '=begin pod\n=para Versions\n=end pod\n'),
      processFile(
        'site/page.podlite',
        '=begin pod\n=TITLE Page\n\n=begin DESCRIPTION\n=include file:./note.podlite\n=end DESCRIPTION\n\n=begin HEADER\n=include file:./note.podlite\n=end HEADER\n\n=begin FOOTER\n=include file:./note.podlite\n=end FOOTER\n=end pod\n',
      ),
      processFile('site/note.podlite', '=begin pod\n=para Note\n=end pod\n'),
    ]
    const [made, page] = only([template, items[1]], [...items, template])
    // the header is written inside the template, so the tree of the template holds it too
    expect(texts(made.node, 'para')).toEqual(['Versions', 'Versions'])
    expect(texts(made.header, 'para')).toEqual(['Versions'])
    for (const field of [page.description, page.header, page.footer]) expect(texts(field, 'para')).toEqual(['Note'])
  })
})
