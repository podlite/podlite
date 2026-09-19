import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { runTests } from '../src/test/run'
import { formatJson } from '../src/test/formatters/json'
import { formatText } from '../src/test/formatters/text'

let dir: string

beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-report-')))
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

const write = (name: string, body: string): string => {
  const file = path.join(dir, name)
  fs.writeFileSync(file, body)
  return file
}

const block = (name: string, body: string, attrs = ''): string => `=begin ${name}${attrs}\n${body}\n=end ${name}\n`
const aTest = (id: string, parts: string[]): string => `=begin test :id<${id}>\n${parts.join('\n')}\n=end test\n`
const fixture = block('fixture', '=head1 A')

const exitCode = (body: string, allowSkipped = false): number =>
  runTests({ tests: [{ kind: 'file', path: write('rules.podlite', body) }], allowSkipped }).exitCode

describe('the report of a run', () => {
  it('is one JSON document with the counts kept apart', () => {
    const main = write(
      'rules.podlite',
      `=pod\n\n${aTest('ok', [fixture, block('assert', 'head1')])}\n${aTest('bad', [
        fixture,
        block('assert', 'head2'),
      ])}\n${aTest('odd', [fixture, block('future', 'x'), block('assert', 'head1')])}`,
    )
    const parsed = JSON.parse(formatJson(runTests({ tests: [{ kind: 'file', path: main }] })))
    expect([parsed.format, parsed.version, parsed.profile, parsed.counts]).toEqual([
      'podlite-test-report',
      1,
      'core',
      { tests: 3, passed: 1, failed: 1, skipped: 1 },
    ])
  })

  it('reads as a line a test in text, with the assertion that did not hold under it', () => {
    const main = write(
      'rules.podlite',
      `=pod\n\n${aTest('ok', [fixture, block('assert', 'head1')])}\n${aTest('bad', [
        fixture,
        block('assert', 'head2', ' :absent'),
        block('assert', 'head1', ' :absent'),
      ])}`,
    )
    const text = formatText(runTests({ tests: [{ kind: 'file', path: main }] }), dir)
    expect(text.split('\n')).toEqual([
      'passed  ok (rules.podlite:3)',
      'failed  bad (rules.podlite:14)',
      '  assertion 2 at rules.podlite:23: :absent head1',
      '    does not hold, against the fixture document rules.podlite#fixture-0, 1 match',
      '    found head at rules.podlite#fixture-0:1',
      '2 tests: 1 passed, 1 failed, 0 skipped',
      '',
    ])
  })

  it('gives an exit code that tells a clean run from a failed, a skipped, an empty and a broken one', () => {
    const skipped = aTest('odd', [fixture, block('future', 'x'), block('assert', 'head1')])
    expect({
      passed: exitCode(`=pod\n\n${aTest('ok', [fixture, block('assert', 'head1')])}`),
      failed: exitCode(`=pod\n\n${aTest('bad', [fixture, block('assert', 'head2')])}`),
      skipped: exitCode(`=pod\n\n${skipped}`),
      allowed: exitCode(`=pod\n\n${skipped}`, true),
      empty: exitCode('=pod\n\nNo tests here.\n'),
      lost: exitCode(`=pod\n\n${aTest('ok', [fixture, block('assert', 'head1')])}\n=include file:./absent.podlite\n`),
    }).toEqual({ passed: 0, failed: 1, skipped: 1, allowed: 0, empty: 1, lost: 1 })
  })

  it('says a run with no tests checked nothing', () => {
    const main = write('rules.podlite', '=pod\n\nNo tests here.\n')
    expect(formatText(runTests({ tests: [{ kind: 'file', path: main }] }), dir)).toBe(
      'no tests were found: nothing was checked\n',
    )
  })
})
