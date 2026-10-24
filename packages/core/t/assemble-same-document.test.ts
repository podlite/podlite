import { getTextContentFromNode } from '@podlite/schema'
import { podlite, readerFor } from '../src'
import { assembleIncludes, assembleAsync, sourcesFromFiles, hasSameDocumentInclude } from '../src/assemble'
import type { IncludeProblem } from '../src/assemble'
import { lintSource } from '../src/lint'
import { runTests } from '../src/test/run'

// Specification.pod6, Include directive: an =include with no source selects from the
// current document in one state, its includes of other sources in and its includes
// with no source as written; one that would bring a block it stands inside fails to
// resolve, and the failure is reported.

const read = readerFor(podlite({ importPlugins: true }))
const main = 'main.podlite'

const assembled = (text: string, files: Record<string, string> = {}) => {
  const problems: IncludeProblem[] = []
  const tree = assembleIncludes(read(text, main), {
    sources: sourcesFromFiles(files),
    context: '',
    file: main,
    text,
    parse: read,
    tolerant: true,
    onError: problem => problems.push(problem),
    onWarning: problem => problems.push(problem),
  })
  return { tree, problems: problems.map(problem => [problem.kind, problem.message]) }
}

// the blocks of a list as name, text of a VERSION, settings, and what a container holds
const shape = (nodes: any[]): string[] =>
  nodes
    .filter(node => node && node.type === 'block')
    .map(node => {
      const text = node.name === 'VERSION' ? `(${String(getTextContentFromNode(node.content)).trim()})` : ''
      const config = (node.config || [])
        .filter((item: any) => item.name !== 'caption')
        .map((item: any) => `${item.name}=${item.value}`)
        .join(',')
      const inner = ['nested', 'root'].includes(node.name) ? `[${shape(node.content).join(' ')}]` : ''
      return `${node.name}${text}${config ? `{${config}}` : ''}${inner}`
    })

describe('an include with no source', () => {
  it('reads the example of the norm as two blocks', () => {
    const { tree, problems } = assembled('=include VERSION\n=VERSION 1.0.0\n')
    expect([shape(tree.content), problems]).toEqual([['VERSION(1.0.0)', 'VERSION(1.0.0)'], []])
  })

  it('does not see the copy another one placed', () => {
    const { tree } = assembled('=include VERSION\n\n=include VERSION\n\n=VERSION 1.0.0\n')
    expect(shape(tree.content)).toEqual(['VERSION(1.0.0)', 'VERSION(1.0.0)', 'VERSION(1.0.0)'])
  })

  it('inside a block it brings is resolved where the copy stands', () => {
    const { tree } = assembled('=include nested\n\n=begin nested\n=include VERSION\n=end nested\n\n=VERSION 1.0.0\n')
    expect(shape(tree.content)).toEqual(['nested[VERSION(1.0.0)]', 'nested[VERSION(1.0.0)]', 'VERSION(1.0.0)'])
  })

  it('sees a block brought from a file, wherever that include is written', () => {
    for (const text of [
      '=include file:meta.podlite\n\n=include VERSION[ :m<1> ]\n',
      '=include VERSION[ :m<1> ]\n\n=include file:meta.podlite\n',
    ]) {
      const { tree } = assembled(text, { 'meta.podlite': '=for VERSION :m<1>\n2.0.0\n' })
      expect(shape(tree.content).sort()).toEqual(['VERSION(2.0.0){m=1}', 'root[VERSION(2.0.0){m=1}]'])
    }
  })

  it('gives the assignment before it to its copy, not to the block it copies', () => {
    const { tree } = assembled('=VERSION 1.0.0\n\n=set :v<1>\n=include VERSION\n')
    expect(shape(tree.content)).toEqual(['VERSION(1.0.0)', 'VERSION(1.0.0){v=1}'])
  })

  it('fails to resolve when the block it would bring holds it, and says so', () => {
    const self = assembled('=begin nested\n=include nested\n=end nested\n')
    expect(shape(self.tree.content)).toEqual(['nested[]'])
    expect(self.problems).toEqual([['cycle', 'include brings nothing: a block it would bring holds it: nested']])
    const mutual = assembled(
      '=begin nested :id<a>\n=include nested[ :id<b> ]\n=end nested\n\n=begin nested :id<b>\n=include nested[ :id<a> ]\n=end nested\n',
    )
    expect(shape(mutual.tree.content)).toEqual(['nested{id=a}[nested{id=b}[]]', 'nested{id=b}[nested{id=a}[]]'])
    expect(mutual.problems.map(([kind]) => kind)).toEqual(['cycle', 'cycle'])
  })

  it('loses the assignment before it when it fails, as an include that fails to resolve does', () => {
    const { tree, problems } = assembled('=begin nested\n=set :a<1>\n=include nested\n\n=para After\n=end nested\n')
    expect(shape(tree.content)).toEqual(['nested[para]'])
    expect(problems).toEqual([
      ['cycle', 'include brings nothing: a block it would bring holds it: nested; =set assignments not applied: a'],
    ])
  })

  it('reads an assignment stopped by a failure in its copy as the block it copies does', () => {
    const { tree, problems } = assembled(
      '=include nested\n\n=begin nested\n=set :a<1>\n=include ABSENT\n\n=include file:loop\n\n=head1 After\n=end nested\n',
      { loop: '=include file:loop\n' },
    )
    expect(shape(tree.content)).toEqual(['nested[root[] head]', 'nested[root[] head]'])
    expect(problems).toEqual([
      ['cycle', 'include brings nothing: loop is already being included; =set assignments not applied: a'],
    ])
  })

  it('takes no block of a Markdown body for the block it stands in', () => {
    const { tree, problems } = assembled(
      '=begin nested\n=begin markdown\n# H\n=end markdown\n\n=include head1\n=end nested\n',
    )
    expect([shape(tree.content), problems]).toEqual([['nested[markdown head]'], []])
  })

  it('leaves a name the bar would make a file unread, as before', () => {
    const { problems } = assembled('=include article.md\n')
    expect(problems.map(([kind]) => kind)).toEqual(['unparsed-selector'])
  })

  it('is assembled the same way when the sources answer later', async () => {
    const files = { 'meta.podlite': '=VERSION 2.0.0\n' }
    const known = sourcesFromFiles(files)
    const text = '=include VERSION\n\n=include file:meta.podlite\n\n=VERSION 1.0.0\n'
    const tree = await assembleAsync(read(text, main), {
      sources: {
        locate: (...args) => Promise.resolve(known.locate(...args)),
        read: source => Promise.resolve(known.read(source)),
      },
      context: '',
      file: main,
      text,
      parse: read,
      tolerant: true,
    })
    expect(shape(tree.content)).toEqual(shape(assembled(text, files).tree.content))
    expect(shape(tree.content)).toEqual(['VERSION(2.0.0)', 'VERSION(1.0.0)', 'root[VERSION(2.0.0)]', 'VERSION(1.0.0)'])
  })

  it('says what it finds in the order of the document', () => {
    const { problems } = assembled('=begin nested\n=include nested\n=end nested\n\n=include file:missing.podlite\n')
    expect(problems.map(([kind]) => kind)).toEqual(['cycle', 'source'])
  })

  it('reads a predicate whose operand names a file, a space before it or not', () => {
    for (const include of [
      '=include Invoice[ :type(in file:voc.podlite | defn) ]',
      '=include Invoice[:type(in file:voc.podlite | defn)]',
    ]) {
      const { tree, problems } = assembled(`${include}\n\n=for Invoice :type<invoice>\nx\n`, {
        'voc.podlite': '=defn invoice\nA bill\n',
      })
      expect([shape(tree.content).length, problems]).toEqual([2, []])
    }
    expect(hasSameDocumentInclude(read('=include Invoice[ :type(in file:voc.podlite | defn) ]\n', main))).toBe(true)
  })

  it('waits while a file its operand names is not known yet', () => {
    const problems: IncludeProblem[] = []
    const text = '=include Invoice[:type(in file:voc.podlite | defn)]\n\n=for Invoice :type<invoice>\nx\n'
    const tree = assembleIncludes(read(text, main), {
      sources: { locate: () => undefined, read: () => undefined },
      context: '',
      file: main,
      parse: read,
      tolerant: true,
      onError: problem => problems.push(problem),
      onWarning: problem => problems.push(problem),
    })
    expect([tree.content.filter((node: any) => node.type === 'block').map((node: any) => node.name), problems]).toEqual(
      [['include', 'Invoice'], []],
    )
  })

  it('keeps a failure under a block copied for an assignment before it reaches the state', () => {
    const { tree, problems } = assembled('=set :outer<1>\n=include file:F\n', {
      F: '=begin nested\n=set :inner<1>\n=include ABSENT\n\n=include file:loop\n\n=head1 After\n=end nested\n',
      loop: '=include file:loop\n',
    })
    expect(shape(tree.content)).toEqual(['root[nested{outer=1}[root[] head]]'])
    expect(problems).toEqual([
      ['cycle', 'include brings nothing: loop is already being included; =set assignments not applied: inner'],
    ])
  })

  it('passes an assignment it brings nothing for on past the file it stands in', () => {
    const { tree, problems } = assembled('=set :a<1>\n=include file:F\n\n=VERSION top\n', { F: '=include ABSENT\n' })
    expect([shape(tree.content), problems]).toEqual([['root[]', 'VERSION(top){a=1}'], []])
  })

  it('says an assignment it brings nothing for has no target at the end of the document', () => {
    for (const [text, files] of [
      ['=set :a<1>\n=include ABSENT\n', {}],
      ['=set :a<1>\n=include file:F\n', { F: '=include ABSENT\n' }],
    ] as Array<[string, Record<string, string>]>) {
      expect(assembled(text, files).problems.map(([kind]) => kind)).toEqual(['set-target'])
    }
  })

  it('gives its copy the way it came itself, then its own step', () => {
    const origin = new WeakMap<object, any>()
    const text = '=include file:F\n\n=VERSION 1\n'
    const tree = assembleIncludes(read(text, main), {
      sources: sourcesFromFiles({ F: '=include VERSION\n' }),
      context: '',
      file: main,
      text,
      parse: read,
      origin,
    })
    const [root, written] = tree.content.filter((node: any) => node.type === 'block')
    const copy = root.content.find((node: any) => node.name === 'VERSION')
    expect([origin.get(copy)?.steps?.map((step: any) => step.file), origin.get(written)?.steps]).toEqual([
      [main, '/F'],
      undefined,
    ])
  })

  it('still reads the settings of an include of a file whose value holds a bracket', () => {
    for (const include of ['=include part.podlite :tag<foo[> | head1', '=include part.podlite :tag("[") | head1']) {
      const { tree, problems } = assembled(`${include}\n`, { 'part.podlite': '=head1 P\n' })
      expect([shape(tree.content), problems]).toEqual([['head'], []])
    }
  })

  it('leaves the includes of files as written, not as brought, where no files are given', () => {
    const origin = new WeakMap<object, any>()
    const text = '=include VERSION\n\n=set :a<1>\n=include file:missing\n\n=VERSION 1\n'
    const tree = assembleIncludes(read(text, main), {
      sources: { locate: () => ({ masked: false, sources: [] }), read: () => null },
      context: '',
      file: main,
      parse: read,
      origin,
      onlySameDocument: true,
    })
    const left = tree.content.find((node: any) => node.name === 'include')
    expect([shape(tree.content), left.set.map((c: any) => c.name), origin.get(left)?.via]).toEqual([
      ['VERSION(1)', 'include', 'VERSION(1)'],
      ['a'],
      undefined,
    ])
  })

  it('is told apart from an include of a file', () => {
    expect(hasSameDocumentInclude(read('=include VERSION\n', main))).toBe(true)
    expect(hasSameDocumentInclude(read('=include file:a.podlite | head1\n', main))).toBe(false)
    expect(hasSameDocumentInclude(read('=include article.md\n', main))).toBe(false)
  })
})

describe('an include with no source where no files are given', () => {
  it('is resolved by lint, which still says nothing of the includes of files', () => {
    const { violations } = lintSource(
      '=begin nested\n=include nested\n=end nested\n\n=include file:missing.podlite\n',
      'x.podlite',
      {},
    )
    expect(violations.map(v => [v.rule, v.message])).toEqual([
      ['include-resolves', 'include brings nothing: a block it would bring holds it: nested'],
    ])
  })
})

describe('the test of the norm', () => {
  it('passes', () => {
    const text = `=begin test :id<includes-of-the-same-document-select-from-one-state>
=begin resource :name<meta.podlite>
=for VERSION :m<1>
2.0.0
=end resource
=begin fixture
=set :a<1>
=include VERSION

=set :b<1>
=include VERSION

=VERSION 1.0.0
=end fixture
=for assert
VERSION[ :a<1> ]
=for assert
VERSION[ :b<1> ]
=for assert :absent
VERSION[ :a<1> :b<1> ]

=begin fixture
=set :c<1>
=include VERSION[ :m<1> ]

=VERSION 1.0.0

=include file:./meta.podlite
=end fixture
=for assert
VERSION[ :m<1> :c<1> ]
=for assert :absent
VERSION[ :c<1> :!?m ]
=end test
`
    const report = runTests({ tests: [{ kind: 'text', name: 'norm.podlite', baseDir: '/virtual', text }] } as any)
    expect(report.tests.map((test: any) => test.status)).toEqual(['passed'])
  })
})
