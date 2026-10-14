import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { runTests } from '../src/test/run'
import type { RunReport } from '../src/test/run'
import { formatJson } from '../src/test/formatters/json'
import { formatText } from '../src/test/formatters/text'

let dir: string

beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-fixture-include-')))
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
const resource = (name: string, body: string): string => block('resource', body, ` :name<${name}>`)
const aTest = (id: string, parts: string[]): string => `=begin test :id<${id}>\n${parts.join('\n')}\n=end test\n`
const assert = (expression: string, attrs = ''): string => block('assert', expression, attrs)

const broken = '=for head1 :id<before>\nBefore\n\n=include file:./missing.podlite\n\n=for head1 :id<after>\nAfter'

const run = (body: string, against: string[] = []): RunReport =>
  runTests({ tests: [{ kind: 'file', path: write('rules.podlite', `=pod\n\n${body}`) }], against })

const includeWarnings = (report: RunReport) =>
  report.problems.filter(p => p.kind === 'include' && p.severity === 'warning')

// Specification.pod6, Test blocks: a fixture whose include fails to resolve remains a
// document for the assertions resolved against it, and the failure is reported apart
describe('a fixture whose include fails to resolve', () => {
  it('is read by its assertions, and the failure is one warning of its own', () => {
    const report = run(
      aTest('broken', [block('fixture', broken), assert('head1[ :id<before> ]'), assert('head1[ :id<after> ]')]),
    )
    expect(report.tests[0].status).toBe('passed')
    expect(report.exitCode).toBe(0)
    const [warning, ...rest] = includeWarnings(report)
    expect(rest).toEqual([])
    expect(warning.kind === 'include' && warning.source).toMatch(/rules\.podlite:\d+#fixture-0$/)
    expect(warning.kind === 'include' && warning.problem.message).toContain('missing.podlite')
    expect(formatText(report, dir)).toMatch(/^warning: rules\.podlite:\d+#fixture-0: .*missing\.podlite/m)
  })

  it('fails an assertion that does not hold by the assertion, and still reports the include', () => {
    const report = run(aTest('false', [block('fixture', broken), assert('head2')]))
    expect(report.tests[0].status).toBe('failed')
    expect(report.tests[0].asserts[0].reason?.kind).toBe('assertion-false')
    expect(includeWarnings(report)).toHaveLength(1)
  })

  it('answers an absence by what was read', () => {
    const report = run(
      aTest('absent', [
        block('fixture', broken),
        assert('head1[ :id<lost> ]', ' :absent'),
        assert('head1[ :id<after> ]', ' :absent'),
      ]),
    )
    expect(report.tests[0].asserts.map(a => a.held)).toEqual([true, false])
    expect(includeWarnings(report)).toHaveLength(1)
  })

  it('names the fixture when the failure sits in a resource it includes', () => {
    const report = run(
      aTest('nested', [
        resource('part.podlite', broken),
        block('fixture', '=include file:./part.podlite'),
        assert('head1[ :id<before> ]'),
        assert('head1[ :id<after> ]'),
      ]),
    )
    expect(report.tests[0].status).toBe('passed')
    const [warning] = includeWarnings(report)
    expect(warning.kind === 'include' && warning.problem.chain.length).toBe(2)
    expect(formatText(report, dir)).toMatch(/^warning: rules\.podlite:\d+#fixture-0: .*part\.podlite:\d+: /m)
  })

  it('reports the fixtures of two tests apart, whatever they share', () => {
    const shared = [
      resource('part.podlite', broken),
      block('fixture', '=include file:./part.podlite'),
      assert('head1[ :id<before> ]'),
    ]
    const report = run(`${aTest('one', shared)}\n${aTest('two', shared)}`)
    const owners = includeWarnings(report).map(p => p.kind === 'include' && p.source)
    expect(owners).toHaveLength(2)
    expect(new Set(owners).size).toBe(2)
    const text = formatText(report, dir)
    for (const owner of owners) expect(text).toContain(`warning: ${path.relative(dir, String(owner))}: `)
  })

  it('reports each include that failed', () => {
    const body = `${broken}\n\n=include file:./missing.podlite\n`
    const report = run(aTest('twice', [block('fixture', body), assert('head1[ :id<after> ]')]))
    expect(includeWarnings(report)).toHaveLength(2)
  })

  it('still keeps a table source it cannot read from its assertions, and reports the include', () => {
    const body = `${broken}\n\n=for data-table :src<https://example.org/table.csv>\n`
    const report = run(aTest('unread', [block('fixture', body), assert('head1[ :id<before> ]')]))
    expect(report.tests[0].asserts[0].reason?.kind).toBe('source-unsupported')
    expect(includeWarnings(report)).toHaveLength(1)
  })

  it('is reported once when its test runs twice, in two files that include it', () => {
    write(
      'shared.podlite',
      `=pod\n\n${aTest('shared', [assert('para'), block('fixture', broken), assert('head1[ :id<before> ]')])}`,
    )
    const a = write('a.podlite', '=pod\n\nA\n\n=include file:./shared.podlite\n')
    const b = write('b.podlite', '=pod\n\nB\n\n=include file:./shared.podlite\n')
    const report = runTests({
      tests: [
        { kind: 'file', path: a },
        { kind: 'file', path: b },
      ],
    })
    expect(report.tests.length).toBe(2)
    expect(includeWarnings(report)).toHaveLength(1)
  })

  it('is not read, and not reported, when the run is against supplied documents', () => {
    const one = write('one.podlite', '=pod\n\n=head1 One\n')
    const two = write('two.podlite', '=pod\n\n=head1 Two\n')
    const report = run(aTest('supplied', [block('fixture', broken), assert('head1')]), [one, two])
    expect(report.counts.passed).toBe(2)
    expect(includeWarnings(report)).toEqual([])
  })

  it('keeps the warning in the JSON report', () => {
    const report = run(aTest('json', [block('fixture', broken), assert('head1[ :id<before> ]')]))
    const parsed = JSON.parse(formatJson(report))
    expect(parsed.exitCode).toBe(0)
    expect(parsed.problems.filter((p: any) => p.kind === 'include' && p.severity === 'warning')).toHaveLength(1)
  })
})

describe('other documents with a failed include', () => {
  it('a supplied one still does not stand for the document its author wrote', () => {
    const doc = write('doc.podlite', '=pod\n\n=head1 Doc\n\n=include file:./missing.podlite\n')
    const report = run(aTest('t', [assert('head1')]), [doc])
    expect(report.tests[0].asserts[0].reason?.kind).toBe('input-error')
    expect(includeWarnings(report)).toEqual([])
  })

  it('a named source still does not', () => {
    write('named.podlite', '=pod\n\n=head1 Named\n\n=include file:./missing.podlite\n')
    const report = run(aTest('t', [assert('file:./named.podlite | head1')]))
    expect(report.tests[0].asserts[0].reason?.kind).toBe('input-error')
  })

  it('a fixture without one is not reported', () => {
    const report = run(aTest('t', [block('fixture', '=head1 Fine'), assert('head1')]))
    expect(report.problems).toEqual([])
  })
})
