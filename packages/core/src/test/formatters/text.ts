import * as path from 'path'
import type { AssertionReason, AssertionResult } from '../evaluate'
import type { RunReport, TestReason, TestResult } from '../run'
import type { CollectionProblem, Place } from '../types'

// a fixture is named after the file of its test and its place in it
const shown = (file: string, cwd: string): string => {
  const hash = file.indexOf('#')
  const disk = hash === -1 ? file : file.slice(0, hash)
  const rest = hash === -1 ? '' : file.slice(hash)
  return path.isAbsolute(disk) ? `${path.relative(cwd, disk) || '.'}${rest}` : file
}

const at = (place: Place, cwd: string): string =>
  `${shown(place.file, cwd)}${place.location ? `:${place.location.start.line}` : ''}`

const describeTestReason = (reason: TestReason, cwd: string): string => {
  switch (reason.kind) {
    case 'assertion':
      return 'an assertion does not hold'
    case 'no-assertions':
      return 'the test has no assertion'
    case 'malformed-test':
      return `${reason.message} (${at(reason.place, cwd)})`
    case 'invalid-test':
      return `${reason.message} (${at(reason.place, cwd)})`
    case 'unknown-child':
      return `a block of an unknown name, ${reason.name}, is in the test (${at(reason.place, cwd)})`
  }
}

const describeAssertionReason = (reason: AssertionReason, cwd: string): string => {
  switch (reason.kind) {
    case 'assertion-false':
      return 'does not hold'
    case 'unsupported-selector':
      return `the selection is not supported: ${reason.selector}`
    case 'source-unavailable':
      return `the source cannot be read: ${reason.source} (from ${shown(reason.base, cwd)})`
    case 'address-unresolved':
      return `the address is not in the source: #${reason.address} in ${reason.source}`
    case 'source-unsupported':
      return `the source is not supported: ${reason.source}, ${reason.message}`
    case 'input-error':
      return `the ${reason.input} document lost content: ${reason.problems.map(p => p.message).join('; ')}`
    case 'implementation-error':
      return `the implementation failed: ${reason.message}`
  }
}

const describeAssertion = (a: AssertionResult, cwd: string): string[] => {
  const input = a.input ? `, against the ${a.input.kind} document ${shown(a.input.document, cwd)}` : ''
  const count = a.matches === undefined ? '' : `, ${a.matches} ${a.matches === 1 ? 'match' : 'matches'}`
  const what = `${a.absent ? ':absent ' : ''}${a.expression}`
  const lines = [
    `  assertion ${a.index + 1} at ${at(a.place, cwd)}: ${what}`,
    `    ${a.held ? 'holds' : a.reason ? describeAssertionReason(a.reason, cwd) : 'does not hold'}${input}${count}`,
  ]
  if (!a.held && a.absent) {
    for (const e of a.evidence) lines.push(`    found ${e.name} at ${at({ file: e.file, location: e.location }, cwd)}`)
  }
  return lines
}

const describeTest = (t: TestResult, cwd: string): string[] => {
  const name = t.id ?? t.caption ?? 'test'
  const against = t.against ? ` against ${shown(t.against, cwd)}` : ''
  const head = `${t.status.padEnd(7)} ${name} (${at(t.place, cwd)})${against}`
  if (t.status === 'passed') return [head]
  const reason = t.reason && t.reason.kind !== 'assertion' ? [`  ${describeTestReason(t.reason, cwd)}`] : []
  return [head, ...reason, ...t.asserts.filter(a => !a.held).flatMap(a => describeAssertion(a, cwd))]
}

const describeProblem = (p: CollectionProblem, cwd: string): string => {
  switch (p.kind) {
    case 'unreadable-source':
      return `error: ${shown(p.source, cwd)}: cannot be read: ${p.message}`
    case 'implementation-error':
      return `error: ${shown(p.source, cwd)}: the implementation failed: ${p.message}`
    case 'include': {
      const step = p.problem.chain[p.problem.chain.length - 1]
      const where = step ? at({ file: step.file, location: step.location }, cwd) : shown(p.source, cwd)
      return `${p.severity}: ${where}: ${p.problem.message}`
    }
  }
}

/*
=begin pod :kind<export>

=head2 formatText

The report as lines for a terminal: a line per test, the failed assertions of a
test that did not pass with the document each read, and a count. Paths are shown
relative to C<cwd>.

=end pod
*/
export const formatText = (report: RunReport, cwd: string = process.cwd()): string => {
  const lines = [
    ...report.problems.map(p => describeProblem(p, cwd)),
    ...report.tests.flatMap(t => describeTest(t, cwd)),
  ]
  const { tests, passed, failed, skipped } = report.counts
  const summary =
    tests === 0
      ? 'no tests were found: nothing was checked'
      : `${tests} ${tests === 1 ? 'test' : 'tests'}: ${passed} passed, ${failed} failed, ${skipped} skipped`
  return `${[...lines, summary].join('\n')}\n`
}
