import type { Location } from '@podlite/schema'
import type { IncludeProblem } from '../resolve-includes'

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

export const ok = <T>(value: T): { ok: true; value: T } => ({ ok: true, value })
export const err = <E>(error: E): { ok: false; error: E } => ({ ok: false, error })

// A file is named by its path on disk; text handed in has no path, so the caller
// names it and says which directory its relative paths start from.
/*
=begin pod :kind<export>

=head2 TestSource

A file of tests by its path, or text handed in under a name, with the directory its
relative paths start from.

=end pod
*/
export type TestSource = { kind: 'file'; path: string } | { kind: 'text'; name: string; text: string; baseDir: string }

// Where a block is written: the file it comes from, not the document it was
// included into.
export type Place = {
  file: string
  location?: Location
}

export type FixtureDecl = {
  // position among the fixtures of the test, from zero
  index: number
  body: string
  place: Place
}

export type ResourceDecl = {
  name: string
  body: string
  place: Place
}

export type AssertDecl = {
  // position among the assertions of the test, from zero
  index: number
  expression: string
  absent: boolean
  caption?: string
  place: Place
  // the source the expression names before its vertical bar, as written
  source?: string
  // the fixture nearest before the assertion; used only when nothing else is
  fixture?: FixtureDecl
}

export type TestShape =
  | { kind: 'runnable' }
  | { kind: 'no-assertions' }
  | { kind: 'unknown-child'; name: string; place: Place }
  | { kind: 'malformed'; message: string; place: Place }
  | { kind: 'invalid'; message: string; place: Place }

export type CollectedTest = {
  // the block the test is written as: one key however many times it is brought in
  key: string
  id?: string
  caption?: string
  place: Place
  // the source of tests it was obtained from, by position in the list given
  obtainedFrom: number
  shape: TestShape
  asserts: AssertDecl[]
  resources: ResourceDecl[]
}

export type CollectionProblem =
  | { kind: 'unreadable-source'; source: string; message: string }
  | { kind: 'include'; severity: 'error' | 'warning'; source: string; problem: IncludeProblem }
  | { kind: 'implementation-error'; source: string; message: string }

// What an assertion is resolved against when it names no source.
export type RunContext =
  | { kind: 'fixture-or-named' }
  | { kind: 'supplied'; document: number }
  | { kind: 'containing'; source: number }

export type PlannedRun = {
  test: CollectedTest
  // every place the same block was obtained at, the one in `test` first
  obtained: CollectedTest[]
  context: RunContext
}
