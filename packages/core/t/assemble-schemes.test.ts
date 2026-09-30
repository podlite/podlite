import { getDocIDs, getFromTree, runSelector } from '@podlite/schema'
import type { ConfigScope, PodliteDocument } from '@podlite/schema'
import { parseAttributes } from '@podlite/schema'
import { podlite } from '../src/index'
import { assembleAsync, assembleIncludes, sourcesFromFiles } from '../src/assemble'
import type { AsyncSources, IncludeProblem, Located, Sources } from '../src/assemble'

const p = podlite({ importPlugins: true })
const read = (source: string, _file?: string, config?: ConfigScope) =>
  p.toAst(p.parse(source, { podMode: 1, config }), { config })

const library = {
  '/lib/dumper.podlite':
    '=begin pod\n=NAME Dumper\n\n=begin code\nsay 1\n=end code\n\n=for para :id<note>\nA note.\n=end pod\n',
  '/lib/vocabulary.podlite': '=begin pod\n=for TITLE :id<Vocabulary>\nTerms\n\n=defn draft\nNot final.\n=end pod\n',
  '/lib/guide.podlite':
    '=begin pod\n=NAME Guide\n\n=defn draft\nA draft.\n\n=for Invoice :type<draft>\nA\n\n=for Invoice :type<paid>\nB\n=end pod\n',
  '/lib/one.podlite': '=begin pod\n=NAME Same\n\n=for para :id<one>\nOne\n=end pod\n',
  '/lib/two.podlite': '=begin pod\n=NAME Same\n\n=para Two\n=end pod\n',
}

// sources that know a document by the names written in it
const byName = (files: Record<string, string>) => {
  const base = sourcesFromFiles(files)
  const located: string[] = []
  const reads: string[] = []
  const namesOf = (path: string): string[] => getDocIDs({ file: path, node: read(files[path]) })
  const sources: Sources = {
    schemes: ['file', 'doc'],
    locate: (path, context, plain, at, scheme) => {
      located.push(`${scheme}:${path}`)
      if (scheme !== 'doc') return base.locate(path, context, plain, at)
      const found = Object.keys(files).filter(file => namesOf(file).includes(path))
      if (found.length > 1) {
        return { masked: false, sources: [], failed: `more than one document is named ${path}: ${found.join(', ')}` }
      }
      return { masked: false, sources: found.map(id => ({ id, name: path, context: '/lib' })) }
    },
    read: source => {
      reads.push(source.id)
      return base.read(source)
    },
  }
  return { sources, located, reads }
}

const assembled = (text: string, sources: Sources, self = '/lib/main.podlite') => {
  const problems: IncludeProblem[] = []
  const tree = assembleIncludes(read(text), {
    sources,
    context: '/lib',
    self,
    file: self,
    parse: read,
    onError: problem => problems.push(problem),
    onWarning: problem => problems.push(problem),
  })
  return { tree, problems }
}
const count = (selector: string, tree: PodliteDocument): number =>
  runSelector(selector, [{ file: 'doc', node: tree }]).length
const includes = (tree: PodliteDocument): number => getFromTree(tree, 'include').length

describe('an include that names a document', () => {
  it('reaches a provider that knows the scheme', () => {
    const { sources } = byName(library)
    const selected = assembled('=include doc:Dumper | code\n', sources)
    expect([count('code', selected.tree), selected.problems]).toEqual([1, []])
    const whole = assembled('=include doc:Dumper\n', sources)
    expect([count('code', whole.tree), count('para[ :id<note> ]', whole.tree), whole.problems]).toEqual([1, 1, []])
    const addressed = assembled('=include doc:Dumper#note\n', sources)
    expect([count('para[ :id<note> ]', addressed.tree), count('code', addressed.tree), addressed.problems]).toEqual([
      1,
      0,
      [],
    ])
  })

  it('is read with the settings in effect at the directive', () => {
    const files = {
      ...library,
      '/lib/marked.podlite': '=begin pod\n=NAME Marked\n\n=begin code\nB<x>\n=end code\n=end pod\n',
    }
    const { tree } = assembled('=config code :allow<B>\n\n=include doc:Marked | code\n', byName(files).sources)
    expect(JSON.stringify(runSelector('code', [{ file: 'doc', node: tree }]))).toContain('"fcode"')
  })

  it('is unsupported for a provider that names no schemes, which is not asked', () => {
    const base = sourcesFromFiles(library)
    let asked = 0
    const sources: Sources = { ...base, locate: (...args) => (asked++, base.locate(...args)) }
    const { tree, problems } = assembled('=include doc:Dumper | code\n', sources)
    expect(problems.map(problem => problem.kind)).toEqual(['unsupported-scheme'])
    expect([asked, includes(tree)]).toEqual([0, 1])
  })

  it('is not found when no document answers to the name', () => {
    const { problems } = assembled('=include doc:Absent\n', byName(library).sources)
    expect(problems.map(problem => [problem.kind, problem.message])).toEqual([
      ['source', 'include target not found: Absent'],
    ])
  })
})

describe('one document under a file path and under its name', () => {
  it('is read once, whichever comes first', () => {
    for (const text of [
      '=include doc:Dumper | code\n\n=include file:./dumper.podlite | para[ :id<note> ]\n',
      '=include file:./dumper.podlite | para[ :id<note> ]\n\n=include doc:Dumper | code\n',
    ]) {
      const { sources, reads } = byName(library)
      const { tree, problems } = assembled(text, sources)
      expect([count('code', tree), count('para[ :id<note> ]', tree), problems]).toEqual([1, 1, []])
      expect(reads.filter(id => id === '/lib/dumper.podlite').length).toBe(1)
    }
  })

  it('is a cycle when it includes itself by name, and is not read to find that out', () => {
    const files = {
      ...library,
      '/lib/main.podlite': '=begin pod\n=NAME Main\n\n=set :id<lost>\n=include doc:Main\n=end pod\n',
    }
    const { sources, reads } = byName(files)
    const { problems } = assembled(files['/lib/main.podlite'], sources)
    expect(problems.map(problem => problem.kind)).toEqual(['cycle'])
    expect(reads).toEqual([])
  })
})

describe('a name that more than one document answers to', () => {
  it('is refused with the reason the provider gives, and the directive stays', () => {
    const { tree, problems } = assembled('=include doc:Same | para\n', byName(library).sources)
    expect(problems.map(problem => [problem.kind, problem.message])).toEqual([
      [
        'source',
        'include source cannot be resolved: doc:Same: more than one document is named Same: /lib/one.podlite, /lib/two.podlite',
      ],
    ])
    expect([includes(tree), count('para', tree)]).toEqual([1, 0])
  })

  it('is refused when the provider gives two sources for a path that is not a mask', () => {
    const base = sourcesFromFiles(library)
    const sources: Sources = {
      schemes: ['file', 'doc'],
      locate: () => ({
        masked: false,
        sources: ['/lib/one.podlite', '/lib/two.podlite'].map(id => ({ id, name: 'Same', context: '/lib' })),
      }),
      read: base.read,
    }
    const { tree, problems } = assembled('=include doc:Same | para\n', sources)
    expect(problems.map(problem => problem.message)).toEqual([
      'include source cannot be resolved: doc:Same: more than one source answers: Same (/lib/one.podlite), Same (/lib/two.podlite)',
    ])
    expect([includes(tree), count('para', tree)]).toEqual([1, 0])
  })

  it('is one source when two answers have one id', () => {
    const base = sourcesFromFiles(library)
    const sources: Sources = {
      schemes: ['doc'],
      locate: () => ({
        masked: false,
        sources: [1, 2].map(() => ({ id: '/lib/one.podlite', name: 'Same', context: '/lib' })),
      }),
      read: base.read,
    }
    const { tree, problems } = assembled('=include doc:Same | para[ :id<one> ]\n', sources)
    expect([count('para[ :id<one> ]', tree), problems]).toEqual([1, []])
  })

  it('keeps the message of a mask that cannot be expanded', () => {
    const sources: Sources = { locate: () => ({ masked: true, sources: [], failed: 'boom' }), read: () => null }
    const { tree, problems } = assembled('=include file:./*.podlite\n', sources)
    expect(problems.map(problem => problem.message)).toEqual(['include mask cannot be expanded: ./*.podlite: boom'])
    expect(includes(tree)).toBe(0)
  })
})

describe('an operand that names a document', () => {
  const text = (operand: string): string => `=include file:./guide.podlite | Invoice[ :type(in ${operand} | defn) ]\n`

  it('is read through a provider that knows the scheme', () => {
    const { tree, problems } = assembled(text('doc:Vocabulary'), byName(library).sources)
    expect([count('Invoice', tree), problems]).toEqual([1, []])
  })

  it('is looked for in the included file when the provider does not know the scheme', () => {
    const { tree, problems } = assembled(text('doc:Guide'), sourcesFromFiles(library))
    expect([count('Invoice', tree), problems]).toEqual([1, []])
  })

  it('does not resolve when it names the document already on the way in', () => {
    const files = {
      ...library,
      '/lib/main.podlite': `=begin pod\n=NAME Main\n\n=defn draft\nMine.\n\n${text('doc:Main')}=end pod\n`,
    }
    const { problems } = assembled(files['/lib/main.podlite'], byName(files).sources)
    expect(problems.map(problem => problem.kind)).toEqual(['operand'])
  })

  it('carries the reason of a refusal', () => {
    const { problems } = assembled(text('doc:Same'), byName(library).sources)
    expect(problems.map(problem => problem.kind)).toEqual(['operand'])
    expect(problems[0].message).toContain('doc:Same: more than one document is named Same')
  })
})

describe('a provider of named documents that answers later', () => {
  const none: Located = { masked: false, sources: [] }
  const later = (files: Record<string, string>) => {
    const { sources: inner, located } = byName(files)
    const sources: AsyncSources = {
      schemes: inner.schemes,
      locate: (path, context, plain, at, scheme) =>
        new Promise<Located>(resolve =>
          setTimeout(() => resolve(inner.locate(path, context, plain, at, scheme) ?? none), 1),
        ),
      read: source => new Promise<string | null>(resolve => setTimeout(() => resolve(inner.read(source) ?? null), 1)),
    }
    return { sources, located }
  }
  const assembledLater = async (text: string, files: Record<string, string> = library) => {
    const problems: IncludeProblem[] = []
    const { sources, located } = later(files)
    const tree = await assembleAsync(read(text), {
      sources,
      context: '/lib',
      parse: read,
      onError: problem => problems.push(problem),
      onWarning: problem => problems.push(problem),
    })
    return { tree, problems, located }
  }

  it('places the document', async () => {
    const { tree, problems } = await assembledLater('=include doc:Dumper | code\n')
    expect([count('code', tree), problems]).toEqual([1, []])
  })

  it('has its refusal reported with the reason', async () => {
    const { problems } = await assembledLater('=include doc:Same\n')
    expect(problems.map(problem => problem.message)).toEqual([
      'include source cannot be resolved: doc:Same: more than one document is named Same: /lib/one.podlite, /lib/two.podlite',
    ])
  })

  it('keeps apart a name and a file path written alike', async () => {
    const files = { ...library, '/lib/Dumper': '=para A file\n' }
    const { tree, problems, located } = await assembledLater(
      '=include doc:Dumper | code\n\n=include file:Dumper\n',
      files,
    )
    expect([count('code', tree), count('para', tree), problems]).toEqual([1, 1, []])
    expect(located.sort()).toEqual(['doc:Dumper', 'file:Dumper'])
  })

  it('reads an operand once the provider has answered', async () => {
    const { tree, problems } = await assembledLater(
      '=include file:./guide.podlite | Invoice[ :type(in doc:Vocabulary | defn) ]\n',
    )
    expect([count('Invoice', tree), problems]).toEqual([1, []])
  })
})

describe('an include whose source is not known yet', () => {
  it('waits, and so does one whose operand is not known yet', () => {
    const base = sourcesFromFiles(library)
    const sources: Sources = {
      schemes: ['file', 'doc'],
      locate: (path, context, plain, at, scheme) =>
        scheme === 'doc' ? undefined : base.locate(path, context, plain, at),
      read: base.read,
    }
    for (const text of [
      '=include doc:Dumper | code\n',
      '=include file:./guide.podlite | Invoice[ :type(in doc:Vocabulary | defn) ]\n',
    ]) {
      const { tree, problems } = assembled(text, sources)
      expect([includes(tree), problems]).toEqual([1, []])
    }
  })
})

describe('what a provider that names schemes leaves as it was', () => {
  it('reads operands with a file, with data and with no source', () => {
    // data and an operand with no source are read in the document the selector is written in
    const own =
      "=begin data :key<kinds> :mime-type('text/tab-separated-values; header=present')\nvalue\tlabel\ndraft\tDraft\n=end data\n\n=defn draft\nMine.\n\n"
    for (const operand of ['in file:./vocabulary.podlite | defn', 'in data:kinds#value', 'in defn']) {
      const text = `${own}=include file:./guide.podlite | Invoice[ :type(${operand}) ]\n`
      const { tree, problems } = assembled(text, byName(library).sources)
      expect([operand, count('Invoice', tree), problems]).toEqual([operand, 1, []])
    }
  })

  it('says nothing of a cycle that loses no =set', () => {
    const files = { ...library, '/lib/main.podlite': '=begin pod\n=NAME Main\n\n=include doc:Main\n=end pod\n' }
    const { sources, reads } = byName(files)
    expect([assembled(files['/lib/main.podlite'], sources).problems, reads]).toEqual([[], []])
  })
})

describe('what a provider that names no schemes does as before', () => {
  const sources = sourcesFromFiles(library)

  it('expands a mask', () => {
    const { tree, problems } = assembled('=include file:./*.podlite | code\n', sources)
    expect([count('code', tree), problems]).toEqual([1, []])
  })

  it('reports a file that is not there', () => {
    const { problems } = assembled('=include file:./absent.podlite\n', sources)
    expect(problems.map(problem => problem.message)).toEqual(['include target not found: ./absent.podlite'])
  })

  it('does not resolve an operand that names the file already on the way in', () => {
    const files = {
      ...library,
      '/lib/main.podlite':
        '=defn draft\nMine.\n\n=include file:./guide.podlite | Invoice[ :type(in file:./main.podlite | defn) ]\n',
    }
    const { problems } = assembled(files['/lib/main.podlite'], sourcesFromFiles(files))
    expect(problems.map(problem => problem.kind)).toEqual(['operand'])
  })
})
