import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { collectTests, planRuns, splitSource } from '../src/test/collect'
import type { CollectedTest } from '../src/test/types'

let dir: string

beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-tests-')))
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

const write = (name: string, body: string): string => {
  const file = path.join(dir, name)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, body)
  return file
}

type TestSpec = { id?: string; fixture?: string; asserts?: string[]; between?: string }

const aTest = ({ id, fixture, asserts = ['head1'], between = '' }: TestSpec): string =>
  [
    `=begin test${id ? ` :id<${id}>` : ''}`,
    fixture === undefined ? '' : `=begin fixture\n${fixture}\n=end fixture\n`,
    between,
    ...asserts.map(a => `=begin assert\n${a}\n=end assert\n`),
    '=end test',
    '',
  ].join('\n')

const collect = (...files: string[]) => collectTests(files.map(file => ({ kind: 'file' as const, path: file })))

const shapes = (tests: CollectedTest[]): string[] => tests.map(t => t.shape.kind)

describe('collecting tests', () => {
  it('names the file and line a test is written at, also when it was included', () => {
    write('t/one.podlite', `=pod\n\n${aTest({ id: 'inner', fixture: '=head1 A' })}`)
    const main = write(
      'main.podlite',
      `=pod\n\nText.\n\n${aTest({ id: 'outer', fixture: '=head1 A' })}\n=include file:./t/one.podlite#inner\n`,
    )
    const { tests, problems } = collect(main)
    expect(problems).toEqual([])
    expect(tests.map(t => [t.id, path.relative(dir, t.place.file), t.place.location?.start.line])).toEqual([
      ['outer', 'main.podlite', 5],
      ['inner', 't/one.podlite', 3],
    ])
  })

  it('names the file an included test is written in when the document has a table of contents', () => {
    write('t/one.podlite', `=pod\n\n${aTest({ id: 'inner', fixture: '=head1 A' })}`)
    const main = write('main.podlite', '=pod\n\n=toc head1\n\n=head1 Rules\n\n=include file:./t/one.podlite#inner\n')
    const { tests } = collect(main)
    expect(tests.map(t => path.relative(dir, t.place.file))).toEqual(['t/one.podlite'])
  })

  it('runs a test with a fixture once when two files bring it in', () => {
    write('t/one.podlite', `=pod\n\n${aTest({ id: 'shared', fixture: '=head1 A' })}`)
    const first = write('first.podlite', '=pod\n\n=include file:./t/one.podlite#shared\n')
    const second = write('second.podlite', '=pod\n\n=include file:./t/one.podlite#shared\n')
    const { tests } = collect(first, second)
    const runs = planRuns(tests, 0)
    expect(tests).toHaveLength(2)
    expect(runs).toHaveLength(1)
    expect(runs[0].obtained.map(t => t.obtainedFrom)).toEqual([0, 1])
  })

  it('runs a test with a fixture under each configuration it is brought in under', () => {
    write('t/one.podlite', `=pod\n\n${aTest({ id: 'shared', fixture: '=head1 A' })}`)
    const include = '=include file:./t/one.podlite#shared\n'
    const first = write('first.podlite', `=pod\n\n=config assert :tag<one>\n\n${include}`)
    const second = write('second.podlite', `=pod\n\n=config assert :tag<two>\n\n${include}`)
    expect(planRuns(collect(first, second).tests, 0)).toHaveLength(2)
  })

  it('runs a test with a fixture once when the configuration it is brought in under is the same', () => {
    write('t/one.podlite', `=pod\n\n${aTest({ id: 'shared', fixture: '=head1 A' })}`)
    const include = '=include file:./t/one.podlite#shared\n'
    const first = write('first.podlite', `=pod\n\n=config assert :tag<one>\n\n${include}`)
    const second = write('second.podlite', `=pod\n\n=head1 Other\n\n=config assert :tag<one>\n\n${include}`)
    expect(planRuns(collect(first, second).tests, 0)).toHaveLength(1)
  })

  it('runs a test with a fixture once when a configuration reaches none of its blocks', () => {
    write('t/one.podlite', `=pod\n\n${aTest({ id: 'shared', fixture: '=head1 A' })}`)
    const include = '=include file:./t/one.podlite#shared\n'
    const first = write('first.podlite', `=pod\n\n=config para :tag<one>\n\n${include}`)
    const second = write('second.podlite', `=pod\n\n${include}`)
    expect(planRuns(collect(first, second).tests, 0)).toHaveLength(1)
  })

  it('runs a test without a fixture in every document that brings it in', () => {
    write('t/one.podlite', `=pod\n\n${aTest({ id: 'around' })}`)
    const first = write('first.podlite', '=pod\n\n=head1 A\n\n=include file:./t/one.podlite#around\n')
    const second = write('second.podlite', '=pod\n\n=include file:./t/one.podlite#around\n')
    const runs = planRuns(collect(first, second).tests, 0)
    expect(runs.map(r => r.context)).toEqual([
      { kind: 'containing', source: 0 },
      { kind: 'containing', source: 1 },
    ])
  })

  it('runs a test once per supplied document when an assertion names no source', () => {
    const main = write(
      'main.podlite',
      `=pod\n\n${aTest({ fixture: '=head1 A' })}\n${aTest({ asserts: ['file:./x.podlite | head1'] })}`,
    )
    const runs = planRuns(collect(main).tests, 2)
    expect(runs.map(r => r.context)).toEqual([
      { kind: 'supplied', document: 0 },
      { kind: 'supplied', document: 1 },
      { kind: 'fixture-or-named' },
    ])
  })

  it('keeps two blocks with one id apart', () => {
    const main = write(
      'main.podlite',
      `=pod\n\n${aTest({ id: 'same', fixture: '=head1 A' })}\n${aTest({ id: 'same', fixture: '=head1 B' })}`,
    )
    const { tests } = collect(main)
    expect(planRuns(tests, 0)).toHaveLength(2)
  })

  it('finds the paragraph and abbreviated forms and a test that is not closed', () => {
    const main = write(
      'main.podlite',
      '=pod\n\n=for test :id<p>\n\n=test\n\n=begin test\n=begin fixture\n=head1 A\n=end fixture\n',
    )
    const { tests } = collect(main)
    expect(shapes(tests)).toEqual(['no-assertions', 'no-assertions', 'malformed'])
    expect(tests[2].place.location?.start.line).toBe(7)
  })

  it('skips a test with a block of an unknown name and keeps the fixture across prose and a comment', () => {
    const main = write(
      'main.podlite',
      [
        '=pod',
        '',
        aTest({ id: 'unknown', fixture: '=head1 A', between: '=begin future\nx\n=end future\n' }),
        aTest({ id: 'prose', fixture: '=head1 A', between: 'Some prose.\n\n=comment note\n' }),
        aTest({ id: 'named', fixture: '=head1 A', between: '=begin Future\nx\n=end Future\n' }),
        aTest({ id: 'stray', fixture: '=head1 A', between: '=end missing\n' }),
      ].join('\n'),
    )
    const { tests } = collect(main)
    expect(tests.map(t => [t.id, t.shape.kind])).toEqual([
      ['unknown', 'unknown-child'],
      ['prose', 'runnable'],
      ['named', 'runnable'],
      ['stray', 'malformed'],
    ])
    expect(tests[1].asserts[0].fixture?.body).toContain('=head1 A')
  })

  it('does not take a line of a table or of another block inside the test for a block of the test', () => {
    const main = write(
      'main.podlite',
      [
        '=pod',
        '',
        aTest({ id: 'table', fixture: '=head1 A', between: '=begin table\n=foo | bar\n=end table\n' }),
        aTest({
          id: 'nested',
          fixture: '=head1 A',
          between: '=begin nested\n=begin future\nx\n=end future\n=end nested\n',
        }),
      ].join('\n'),
    )
    expect(collect(main).tests.map(t => [t.id, t.shape.kind])).toEqual([
      ['table', 'runnable'],
      ['nested', 'runnable'],
    ])
  })

  it('finds a broken structure inside a block of the test', () => {
    const main = write(
      'main.podlite',
      `=pod\n\n${aTest({ id: 'stray', fixture: '=head1 A', between: '=begin nested\n=end missing\n=end nested\n' })}`,
    )
    expect(collect(main).tests.map(t => [t.id, t.shape.kind])).toEqual([['stray', 'malformed']])
  })

  it('finds a broken structure inside an item and a definition, and none in a table row or a fixture body', () => {
    const cases = {
      item: '=begin item\n=end missing\n=end item\n',
      defn: '=begin defn\nTerm\n=end missing\n=end defn\n',
      table: '=begin table\n=end missing | value\n=end table\n',
      body: '=for fixture\n=end missing\n\n',
    }
    const main = write(
      'main.podlite',
      `=pod\n\n${Object.entries(cases)
        .map(([id, between]) => aTest({ id, between }))
        .join('\n')}`,
    )
    expect(collect(main).tests.map(t => [t.id, t.shape.kind])).toEqual([
      ['item', 'malformed'],
      ['defn', 'malformed'],
      ['table', 'runnable'],
      ['body', 'runnable'],
    ])
  })

  it('reads what follows a folded heading as part of the test', () => {
    const folded = (id: string, after: string): string =>
      `=begin test :id<${id}>\n=begin fixture\n=head1 A\n=end fixture\n\n=for head1 :folded\nHeading\n\n${after}=end test\n`
    const main = write(
      'main.podlite',
      `=pod\n\n${[
        folded('unknown', '=future x\n\n=for assert\nhead1\n\n'),
        folded('stray', '=end missing\n=for assert\nhead1\n\n'),
        folded('assert', '=for assert\nhead1\n\n'),
      ].join('\n')}`,
    )
    expect(collect(main).tests.map(t => [t.id, t.shape.kind, t.asserts.length])).toEqual([
      ['unknown', 'unknown-child', 1],
      ['stray', 'malformed', 1],
      ['assert', 'runnable', 1],
    ])
  })

  it('finds a broken structure in a file an include puts inside a block of the test, and pairs lines across a blank one', () => {
    write('child.podlite', '=end missing\n')
    const split = write(
      'split.podlite',
      `=pod\n\n${aTest({
        id: 'split',
        fixture: '=head1 A',
        between: '=begin nested\n=begin future\nx\n\ny\n=end future\n=end nested\n',
      })}`,
    )
    expect(collect(split).tests.map(t => t.shape.kind)).toEqual(['runnable'])
    const main = write(
      'main.podlite',
      `=pod\n\n${aTest({
        id: 'deep',
        fixture: '=head1 A',
        between: '=begin nested\n=include file:./child.podlite\n=end nested\n',
      })}`,
    )
    const [test] = collect(main).tests
    expect([test.shape.kind, test.shape.kind === 'malformed' && path.basename(test.shape.place.file)]).toEqual([
      'malformed',
      'child.podlite',
    ])
  })

  it('does not let a closing line after a block close what was opened inside it', () => {
    const main = write(
      'main.podlite',
      `=pod\n\n${aTest({
        id: 'escape',
        fixture: '=head1 A',
        between: '=begin nested\n=begin future\n=end nested\n=end future\n',
      })}`,
    )
    expect(collect(main).tests.map(t => t.shape.kind)).toEqual(['malformed'])
  })

  it('finds a block of an unknown name that an include puts right under the test', () => {
    write('child.podlite', '=future text\n')
    const main = write(
      'main.podlite',
      `=pod\n\n${aTest({ id: 'included', fixture: '=head1 A', between: '=include file:./child.podlite\n' })}`,
    )
    const [test] = collect(main).tests
    expect([test.shape.kind, test.shape.kind === 'unknown-child' && path.basename(test.shape.place.file)]).toEqual([
      'unknown-child',
      'child.podlite',
    ])
  })

  it('does not take a test out of a code block, a fixture or a resource', () => {
    const inner = aTest({ fixture: '=head1 A' })
    const main = write(
      'main.podlite',
      `=pod\n\n=begin code\n${inner}=end code\n\n=begin test :id<outer>\n=begin fixture\n${inner}=end fixture\n\n=begin resource :name<r.podlite>\n${inner}=end resource\n\n=begin assert\ntest\n=end assert\n=end test\n`,
    )
    expect(collect(main).tests.map(t => t.id)).toEqual(['outer'])
  })

  it('reports an include whose selector cannot be read as a collection error, also inside an included file', () => {
    write('t/one.podlite', `=pod\n\n${aTest({ id: 'one', fixture: '=head1 A' })}`)
    write('inner.podlite', '=pod\n\n=include file:./t/one.podlite | test[\n')
    const main = write(
      'main.podlite',
      '=pod\n\n=include file:./t/one.podlite | test[\n\n=include file:./inner.podlite\n',
    )
    const { tests, problems } = collect(main)
    expect(tests).toEqual([])
    expect(
      problems.map(p => (p.kind === 'include' ? [p.severity, p.problem.kind, p.problem.chain.length] : p.kind)),
    ).toEqual([
      ['error', 'unparsed-selector', 1],
      ['error', 'unparsed-selector', 2],
    ])
  })

  it('reports an include of an unknown scheme as a collection error', () => {
    const main = write('main.podlite', '=pod\n\n=include nosuch:./t/one.podlite | test\n')
    const { problems } = collect(main)
    expect(problems.map(p => (p.kind === 'include' ? [p.severity, p.problem.kind] : p.kind))).toEqual([
      ['error', 'unsupported-scheme'],
    ])
  })

  it('reports two resources of one name as a mistake of the test', () => {
    const between =
      '=begin resource :name<r.podlite>\nA\n=end resource\n\n=begin resource :name<r.podlite>\nB\n=end resource\n'
    const main = write('main.podlite', `=pod\n\n${aTest({ fixture: '=head1 A', between })}`)
    expect(shapes(collect(main).tests)).toEqual(['invalid'])
  })
})

describe('the source an assertion names', () => {
  it('is what stands before the vertical bar, or a scheme with no selection after it', () => {
    expect(
      [
        'head1',
        'article.podlite | head1',
        'file:./guide.podlite#Overview',
        "para[ :author('a | b') ]",
        'Invoice[ :type(in file:./v.podlite | defn) ]',
      ].map(e => splitSource(e).source),
    ).toEqual([undefined, 'article.podlite', 'file:./guide.podlite#Overview', undefined, undefined])
  })
})
