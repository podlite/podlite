/*
=begin pod :kind<module>

=head1 podlite/test

Runs the tests written in Podlite files: C<=test> blocks with their C<=fixture>,
C<=assert> and C<=resource>. A run can also examine documents given from outside with
the same tests, which is how a set of assertions checks documents of a project.

=end pod
*/
export { runTests } from './run'
export type { RunOptions, RunReport, TestResult, TestStatus } from './run'
export { collectTests, planRuns } from './collect'
export { inputsFor } from './sources'
export { evaluateAssertion } from './evaluate'
export type { AssertionResult } from './evaluate'
export { coreProfile, schemaProfile } from './documents'
export type { Profile } from './documents'
export { formatText } from './formatters/text'
export { formatJson } from './formatters/json'
export type { TestSource } from './types'
