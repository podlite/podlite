import { collectTests, planRuns } from './collect'
import { coreProfile } from './documents'
import type { Profile } from './documents'
import { evaluateAssertion } from './evaluate'
import type { AssertionResult } from './evaluate'
import { inputsFor, prepareSupplied } from './sources'
import type { CollectedTest, CollectionProblem, Place, PlannedRun, TestSource } from './types'

/*
=begin pod :kind<export>

=head2 TestStatus

The outcome of one test. C<skipped> is kept for a test holding a block of a name the
implementation does not know; a test it knows but cannot carry out is C<failed>.

=end pod
*/
export type TestStatus = 'passed' | 'failed' | 'skipped'

export type TestReason =
  | { kind: 'assertion' }
  | { kind: 'no-assertions' }
  | { kind: 'malformed-test'; message: string; place: Place }
  | { kind: 'invalid-test'; message: string; place: Place }
  | { kind: 'unknown-child'; name: string; place: Place }

/*
=begin pod :kind<export>

=head2 TestResult

One test as run: where it is written, the files of tests it was obtained from, the
document it was run against when one was given, its outcome and why, and each
assertion.

=end pod
*/
export type TestResult = {
  id?: string
  caption?: string
  place: Place
  // the files of tests it was obtained from
  obtainedFrom: string[]
  // the document given to examine, when the run was against one
  against?: string
  status: TestStatus
  reason?: TestReason
  asserts: AssertionResult[]
}

/*
=begin pod :kind<export>

=head2 RunReport

Everything a run found, as plain data: the tests, the problems met while collecting
them, the counts, and the exit code the command would give. C<version> changes when
the shape does.

=end pod
*/
export type RunReport = {
  format: 'podlite-test-report'
  version: 1
  profile: string
  tests: TestResult[]
  problems: CollectionProblem[]
  counts: { tests: number; passed: number; failed: number; skipped: number }
  exitCode: 0 | 1 | 2
}

/*
=begin pod :kind<export>

=head2 RunOptions

The files to take tests from, the documents to examine with them, the profile the
documents are read with, and whether skipped tests alone may pass the run. A file
given both ways is still read twice: the tests of a file are not a document to
examine.

=end pod
*/
export type RunOptions = {
  tests: TestSource[]
  // documents to examine, each by the whole set of tests
  against?: string[]
  profile?: Profile
  // passed and skipped tests alone do not fail the run
  allowSkipped?: boolean
}

const statusOf = (test: CollectedTest, asserts: AssertionResult[]): Pick<TestResult, 'status' | 'reason'> => {
  const { shape } = test
  switch (shape.kind) {
    case 'unknown-child':
      return { status: 'skipped', reason: { kind: 'unknown-child', name: shape.name, place: shape.place } }
    case 'malformed':
      return { status: 'failed', reason: { kind: 'malformed-test', message: shape.message, place: shape.place } }
    case 'invalid':
      return { status: 'failed', reason: { kind: 'invalid-test', message: shape.message, place: shape.place } }
    case 'no-assertions':
      return { status: 'failed', reason: { kind: 'no-assertions' } }
    case 'runnable':
      return asserts.every(a => a.held) ? { status: 'passed' } : { status: 'failed', reason: { kind: 'assertion' } }
  }
}

const isImplementationError = (problem: CollectionProblem): boolean => problem.kind === 'implementation-error'

const losesTests = (problem: CollectionProblem): boolean =>
  problem.kind === 'unreadable-source' || (problem.kind === 'include' && problem.severity === 'error')

const exitCodeOf = (tests: TestResult[], problems: CollectionProblem[], allowSkipped: boolean): 0 | 1 | 2 => {
  const broken =
    problems.some(isImplementationError) ||
    tests.some(t => t.asserts.some(a => a.reason?.kind === 'implementation-error'))
  if (broken) return 2
  if (tests.length === 0 || problems.some(losesTests)) return 1
  if (tests.some(t => t.status === 'failed')) return 1
  if (!allowSkipped && tests.some(t => t.status === 'skipped')) return 1
  return 0
}

/*
=begin pod :kind<export>

=head2 runTests

Collects the tests of the files given, runs each once or once per document it has to
read, and reports. Nothing is printed and the process exit code is not touched: the
code is in the report.

The exit code is 2 when the implementation failed, 1 when a test failed, a test was
skipped and that is not allowed, no test was found, or an include lost tests, and 0
otherwise.

=end pod
*/
export const runTests = (opts: RunOptions): RunReport => {
  const profile = opts.profile ?? coreProfile
  const against = opts.against ?? []
  const collection = collectTests(opts.tests, profile)
  const supplied = against.map(file => prepareSupplied(file, profile))
  const env = {
    profile,
    supplied,
    containing: (index: number) => collection.sources.find(s => s.index === index),
  }
  const sourceName = (index: number): string => collection.sources.find(s => s.index === index)?.name ?? String(index)

  const results = planRuns(collection.tests, against.length).map((run: PlannedRun): TestResult => {
    const { test, context } = run
    const input = inputsFor(test, context, env)
    const asserts = test.shape.kind === 'runnable' ? test.asserts.map(a => evaluateAssertion(a, input(a), profile)) : []
    return {
      id: test.id,
      caption: test.caption,
      place: test.place,
      obtainedFrom: run.obtained.map(t => sourceName(t.obtainedFrom)),
      against: context.kind === 'supplied' ? against[context.document] : undefined,
      ...statusOf(test, asserts),
      asserts,
    }
  })

  const counts = {
    tests: results.length,
    passed: results.filter(t => t.status === 'passed').length,
    failed: results.filter(t => t.status === 'failed').length,
    skipped: results.filter(t => t.status === 'skipped').length,
  }
  return {
    format: 'podlite-test-report',
    version: 1,
    profile: profile.name,
    tests: results,
    problems: collection.problems,
    counts,
    exitCode: exitCodeOf(results, collection.problems, opts.allowSkipped === true),
  }
}
