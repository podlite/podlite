import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { runTests } from '../src/test/run'
import { coreProfile } from '../src/test/documents'
import type { Profile } from '../src/test/documents'
import type { RunReport } from '../src/test/run'

let dir: string

beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-evaluate-')))
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

const block = (name: string, body: string, attrs = ''): string => `=begin ${name}${attrs}\n${body}\n=end ${name}\n`
const aTest = (id: string, parts: string[]): string => `=begin test :id<${id}>\n${parts.join('\n')}\n=end test\n`

const run = (file: string, opts: { against?: string[]; profile?: Profile } = {}): RunReport =>
  runTests({ tests: [{ kind: 'file', path: file }], ...opts })

const outcomes = (report: RunReport): Array<[string | undefined, string, boolean[]]> =>
  report.tests.map(t => [t.id, t.status, t.asserts.map(a => a.held)])

describe('an assertion', () => {
  it('holds when a block matches, and under :absent when none does', () => {
    const fixture = block('fixture', '=head1 A')
    const main = write(
      'rules.podlite',
      `=pod\n\n${aTest('present', [fixture, block('assert', 'head1')])}\n${aTest('absent', [
        fixture,
        block('assert', 'head1', ' :absent'),
      ])}`,
    )
    expect(outcomes(run(main))).toEqual([
      ['present', 'passed', [true]],
      ['absent', 'failed', [false]],
    ])
  })

  it('fails the test when one of several does not hold, and the others stay in the report', () => {
    const main = write(
      'rules.podlite',
      `=pod\n\n${aTest('three', [
        block('fixture', '=head1 A'),
        block('assert', 'head1'),
        block('assert', 'head2'),
        block('assert', 'head3', ' :absent'),
      ])}`,
    )
    const [test] = run(main).tests
    expect([test.status, test.asserts.map(a => [a.held, a.reason?.kind ?? null])]).toEqual([
      'failed',
      [
        [true, null],
        [false, 'assertion-false'],
        [true, null],
      ],
    ])
  })

  it('does not hold under :absent when the profile cannot run its selection', () => {
    const profile: Profile = { ...coreProfile, name: 'narrow', supports: selection => !selection.includes('head2') }
    const main = write(
      'rules.podlite',
      `=pod\n\n${aTest('narrow', [block('fixture', '=head1 A'), block('assert', 'head2', ' :absent')])}`,
    )
    const [test] = run(main, { profile }).tests
    expect([test.status, test.asserts[0].reason, test.asserts[0].matches]).toEqual([
      'failed',
      { kind: 'unsupported-selector', selector: 'head2' },
      undefined,
    ])
  })

  it('tells a test it cannot carry out from one with a block it does not know', () => {
    const profile: Profile = { ...coreProfile, supports: selection => !selection.includes('head2') }
    const main = write(
      'rules.podlite',
      `=pod\n\n${aTest('cannot', [block('fixture', '=head1 A'), block('assert', 'head2')])}\n${aTest('unknown', [
        block('fixture', '=head1 A'),
        block('future', 'x'),
        block('assert', 'head1'),
      ])}`,
    )
    expect(run(main, { profile }).tests.map(t => [t.id, t.status, t.reason?.kind])).toEqual([
      ['cannot', 'failed', 'assertion'],
      ['unknown', 'skipped', 'unknown-child'],
    ])
  })

  it('names the test, the assertion, the document read and the file a found block is written in', () => {
    write('third.podlite', '=pod\n\n=head1 Third\n')
    write('named.podlite', '=pod\n\n=include file:./third.podlite\n')
    const main = write(
      'rules.podlite',
      `=pod\n\n${aTest('origin', [block('assert', 'file:./named.podlite | head1', ' :absent')])}`,
    )
    const [test] = run(main).tests
    const [a] = test.asserts
    expect({
      test: [test.id, path.relative(dir, test.place.file), test.place.location?.start.line],
      assertion: [a.index, a.place.location?.start.line],
      input: [a.input?.kind, path.relative(dir, a.input?.document ?? ''), a.input?.source],
      found: a.evidence.map(e => [e.name, path.relative(dir, e.file), e.location?.start.line]),
    }).toEqual({
      test: ['origin', 'rules.podlite', 3],
      assertion: [0, 4],
      input: ['named', 'named.podlite', 'file:./named.podlite'],
      found: [['head', 'third.podlite', 3]],
    })
  })

  it('names the document it read when nothing matched', () => {
    const main = write(
      'rules.podlite',
      `=pod\n\n${aTest('none', [block('fixture', '=para Only.'), block('assert', 'head1')])}`,
    )
    const [a] = run(main).tests[0].asserts
    expect([a.matches, a.input?.kind, path.relative(dir, a.input?.document ?? '')]).toEqual([
      0,
      'fixture',
      'rules.podlite#fixture-0',
    ])
  })

  it('reaches the tests of a document it reads without running them', () => {
    const doc = write('doc.podlite', `=pod\n\n${aTest('inner', [block('assert', 'head9')])}`)
    const main = write('rules.podlite', `=pod\n\n${aTest('outer', [block('assert', 'test')])}`)
    const report = run(main, { against: [doc] })
    expect(report.tests.map(t => [t.id, t.status, t.asserts[0].matches])).toEqual([['outer', 'passed', 1]])
  })

  it('does not hold under :absent over a data table whose source is not read', () => {
    const main = write(
      'rules.podlite',
      `=pod\n\n${aTest('table', [
        block('fixture', '=for data-table :src<file:missing.csv>\n'),
        block('assert', 'cell', ' :absent'),
      ])}`,
    )
    const [a] = run(main).tests[0].asserts
    expect([a.held, a.reason?.kind, a.matches]).toEqual([false, 'source-unsupported', undefined])
  })

  it('does not hold under :absent over a data table whose data: source cannot be had', () => {
    const main = write(
      'rules.podlite',
      `=pod\n\n${aTest('missing-data', [
        block('fixture', '=for data-table :src<data:missing>\n'),
        block('assert', 'cell', ' :absent'),
      ])}`,
    )
    const [a] = run(main).tests[0].asserts
    expect([a.held, a.reason?.kind, a.matches]).toEqual([false, 'source-unsupported', undefined])
  })

  it('places a block found inside a Markdown section at the section', () => {
    const main = write(
      'rules.podlite',
      `=pod\n\n${aTest('md', [
        block('fixture', '=para Before.\n\n=begin markdown\n= :caption<Caption>\n# Title\n=end markdown'),
        block('assert', 'head1', ' :absent'),
      ])}`,
    )
    const [e] = run(main).tests[0].asserts[0].evidence
    expect([e.name, e.precision, e.location?.start.line]).toEqual(['head', 'section', 3])
  })

  it('finds a paragraph of a Markdown section', () => {
    const main = write(
      'rules.podlite',
      `=pod\n\n${aTest('md-para', [block('fixture', '=begin markdown\nText.\n=end markdown'), block('assert', 'para')])}`,
    )
    const [a] = run(main).tests[0].asserts
    expect([a.held, a.matches]).toEqual([true, 1])
  })

  it('finds a paragraph of a folded section', () => {
    const fixture = '=for head1 :folded\nFolded\n\nText under it.\n\n=head1 Next'
    const main = write('rules.podlite', `=pod\n\n${aTest('folded-para', [block('fixture', fixture), block('assert', 'para')])}`)
    const [a] = run(main).tests[0].asserts
    expect([a.held, a.matches]).toEqual([true, 1])
  })

  it('reads a file operand from the file of the test, and fails an assertion whose operand does not resolve', () => {
    write('vocabulary.podlite', '=defn paid\nMoney in.\n')
    const main = write(
      'rules.podlite',
      `=pod\n\n${aTest('operand', [
        block('fixture', '=for para :status<paid>\ntext'),
        block('assert', 'para[ :status(in file:./vocabulary.podlite | defn) ]'),
        block('assert', 'para[ :status(in file:./none.podlite | defn) ]', ' :absent'),
      ])}`,
    )
    const [found, lost] = run(main).tests[0].asserts
    expect([found.held, lost.held, lost.reason?.kind]).toEqual([true, false, 'operand-unresolved'])
  })

  it('holds under :absent over a table whose data was read and holds no rows', () => {
    const fixture = '=begin data :key<empty> :mime-type<text/csv>\n=end data\n\n=table data:empty\n'
    const main = write(
      'rules.podlite',
      `=pod\n\n${aTest('empty', [block('fixture', fixture), block('assert', 'cell', ' :absent')])}`,
    )
    const [a] = run(main).tests[0].asserts
    expect([a.held, a.reason?.kind ?? null, a.matches]).toEqual([true, null, 0])
  })

  it('places at the section a Markdown block an address brings in alone', () => {
    const main = write(
      'rules.podlite',
      `=pod\n\n${aTest('addressed', [
        block('resource', '=pod\n\n=begin markdown\n# Title\n=end markdown', ' :name<r.podlite>'),
        block('fixture', '=include file:./r.podlite#Title'),
        block('assert', 'head1', ' :absent'),
      ])}`,
    )
    const [e] = run(main).tests[0].asserts[0].evidence
    expect([e.precision, e.file, e.location?.start.line]).toEqual(['section', 'resource:r.podlite', 3])
  })

  it('does not take a missing data table source for an empty one, whatever its name or form', () => {
    const tests = ["=for data-table :src('data:has no rows')\n", '=for data-table :src(42)\n'].map((fixture, i) =>
      aTest(`t${i}`, [block('fixture', fixture), block('assert', 'cell', ' :absent')]),
    )
    const main = write('rules.podlite', `=pod\n\n${tests.join('\n')}`)
    expect(run(main).tests.map(t => [t.status, t.asserts[0].reason?.kind])).toEqual([
      ['failed', 'source-unsupported'],
      ['failed', 'source-unsupported'],
    ])
  })

  it('counts a table whose data could not be had only when it is in the document read', () => {
    const resource = '=for head1 :id<ok>\nFine\n\n=for data-table :src<data:missing>\n'
    const main = write(
      'rules.podlite',
      `=pod\n\n${aTest('outside', [
        block('resource', resource, ' :name<r.podlite>'),
        block('fixture', '=include file:./r.podlite#ok'),
        block('assert', 'head1'),
      ])}`,
    )
    expect(run(main).tests.map(t => t.status)).toEqual(['passed'])
  })

  it('reads the source of a data table the way the table does, and ties lost data to the table alone', () => {
    const tests = [
      aTest('first-empty', [
        block('fixture', '=for data-table :src<> :src<file:missing.csv> :mime-type<text/csv>\n'),
        block('assert', 'cell', ' :absent'),
      ]),
      aTest('file-table', [block('fixture', '=table file:missing.csv\n'), block('assert', 'head1', ' :absent')]),
      aTest('same-offset', [
        block(
          'resource',
          '=for data-table :src<data:missing>\n\n=begin markdown\n# Title\n=end markdown',
          ' :name<r.podlite>',
        ),
        block('fixture', '=include file:./r.podlite#Title'),
        block('assert', 'head1'),
      ]),
    ]
    const main = write('rules.podlite', `=pod\n\n${tests.join('\n')}`)
    expect(run(main).tests.map(t => [t.id, t.status])).toEqual([
      ['first-empty', 'failed'],
      ['file-table', 'failed'],
      ['same-offset', 'passed'],
    ])
  })

  it('keeps the section of an addressed Markdown block when the document has a table of contents', () => {
    const main = write(
      'rules.podlite',
      `=pod\n\n${aTest('toc', [
        block('resource', '=pod\n\n=begin markdown\n# Title\n=end markdown', ' :name<r.podlite>'),
        block('fixture', '=toc head1\n\n=include file:./r.podlite#Title'),
        block('assert', 'head1', ' :absent'),
      ])}`,
    )
    const [e] = run(main).tests[0].asserts[0].evidence
    expect([e.precision, e.location?.start.line]).toEqual(['section', 3])
  })

  it('does not give included tests the =config of the supplied document', () => {
    write('t/one.podlite', `=pod\n\n${aTest('included', [block('assert', 'head1')])}`)
    const doc = write('doc.podlite', '=pod\n\n=config test :tag<host>\n\n=include file:./t/one.podlite#included\n')
    const main = write(
      'rules.podlite',
      `=pod\n\n${aTest('no-host-tests', [block('assert', 'test[ :tag<host> ]', ' :absent')])}`,
    )
    const [test] = run(main, { against: [doc] }).tests
    expect([test.status, test.asserts[0].matches]).toEqual(['passed', 0])
  })

  it('checks each supplied document on its own', () => {
    const first = write('first.podlite', '=pod\n\n=head1 In first\n')
    const second = write('second.podlite', '=pod\n\n=para No heading.\n')
    const main = write('rules.podlite', `=pod\n\n${aTest('has-heading', [block('assert', 'head1')])}`)
    const report = run(main, { against: [first, second] })
    expect(report.tests.map(t => [path.basename(t.against ?? ''), t.status, t.asserts[0].evidence.length])).toEqual([
      ['first.podlite', 'passed', 1],
      ['second.podlite', 'failed', 0],
    ])
  })
})
