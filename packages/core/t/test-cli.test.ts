import { spawnSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

const bin = path.join(__dirname, '..', 'bin', 'podlite.js')

type Run = { code: number | null; stdout: string; stderr: string }

const run = (args: string[], cwd: string): Run => {
  const result = spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf-8', stdio: 'pipe' })
  return { code: result.status, stdout: result.stdout, stderr: result.stderr }
}

let dir: string

beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'podlite-test-cli-')))
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

const write = (name: string, body: string): string => {
  fs.writeFileSync(path.join(dir, name), body)
  return name
}

const block = (name: string, body: string, attrs = ''): string => `=begin ${name}${attrs}\n${body}\n=end ${name}\n`
const aTest = (id: string, parts: string[]): string => `=begin test :id<${id}>\n${parts.join('\n')}\n=end test\n`

describe('podlite test', () => {
  it('exits by the outcome of the tests and by the arguments it was given', () => {
    const fixture = block('fixture', '=head1 A')
    write('pass.podlite', `=pod\n\n${aTest('ok', [fixture, block('assert', 'head1')])}`)
    write('fail.podlite', `=pod\n\n${aTest('bad', [fixture, block('assert', 'head2')])}`)
    write('skip.podlite', `=pod\n\n${aTest('odd', [fixture, block('future', 'x'), block('assert', 'head1')])}`)
    write('empty.podlite', '=pod\n\nNo tests.\n')
    write(
      'lost.podlite',
      `=pod\n\n${aTest('ok', [fixture, block('assert', 'head1')])}\n=include file:./absent.podlite\n`,
    )
    const codes = [
      ['pass.podlite'],
      ['fail.podlite'],
      ['skip.podlite'],
      ['skip.podlite', '--allow-skipped'],
      ['empty.podlite'],
      ['lost.podlite'],
      [],
      ['pass.podlite', '--against'],
      ['pass.podlite', '--format', 'xml'],
    ].map(args => run(['test', ...args], dir).code)
    expect(codes).toEqual([0, 1, 1, 0, 1, 1, 2, 2, 2])
  })

  it('checks a document given with --against and writes json that parses whole', () => {
    write('rules.podlite', `=pod\n\n${aTest('has-heading', [block('assert', 'head1')])}`)
    write('doc.podlite', '=pod\n\n=head1 Here\n')
    const result = run(['test', 'rules.podlite', '--against', 'doc.podlite', '--format', 'json'], dir)
    const report = JSON.parse(result.stdout)
    expect([result.code, report.counts.passed, path.basename(report.tests[0].against)]).toEqual([0, 1, 'doc.podlite'])
  })

  it('is listed in the help', () => {
    expect(run(['--help'], dir).stdout).toMatch(/podlite test <files\.\.\.>/)
  })
})
