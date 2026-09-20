import * as path from 'path'
import { bindTarget, buildBindingIndex } from '@podlite/schema'
import type { PodliteDocument, PodNode } from '@podlite/schema'
import type { IncludeProblem } from '../resolve-includes'
import { diskProvider } from '../resolve-includes'
import { canonical, prepareDocument, readDocument } from './documents'
import type { PreparedDocument, Profile } from './documents'
import { RESOURCE_ROOT, resourceProvider } from './resources'
import type { AssertDecl, CollectedTest, FixtureDecl, Result, RunContext } from './types'
import { err, ok } from './types'

export type InputKind = 'named' | 'supplied' | 'fixture' | 'containing'

export type AssertionInput = {
  kind: InputKind
  document: PreparedDocument
  // the node the selection starts from: the document, or the block an address names
  target: PodNode | PodliteDocument
  // the source as written in the assertion, and the directory it was read from
  source?: string
  base?: string
  fixture?: FixtureDecl
  supplied?: number
}

export type InputFailure =
  | { kind: 'source-unavailable'; input: InputKind; source: string; base: string; message: string }
  | { kind: 'address-unresolved'; input: InputKind; source: string; address: string }
  | { kind: 'source-unsupported'; input: InputKind; source: string; message: string }
  | { kind: 'input-error'; input: InputKind; problems: IncludeProblem[] }
  | { kind: 'implementation-error'; input: InputKind; message: string }

export type SuppliedDocument = Result<PreparedDocument, InputFailure>

export type InputEnvironment = {
  profile: Profile
  supplied: SuppliedDocument[]
  // the prepared source of tests a test was obtained from
  containing: (source: number) => PreparedDocument | undefined
}

const hasMask = (target: string): boolean => /[*?]/.test(target)

// A source written without a scheme is a file.
const readSourceExpression = (source: string): { scheme: string; document: string; address?: string } => {
  const withScheme = source.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):(.*)$/)
  const scheme = withScheme ? withScheme[1] : 'file'
  const rest = withScheme ? withScheme[2] : source
  const hash = rest.indexOf('#')
  return hash === -1
    ? { scheme, document: rest }
    : { scheme, document: rest.slice(0, hash), address: rest.slice(hash + 1) || undefined }
}

const whole = (document: PreparedDocument, input: InputKind): Result<PreparedDocument, InputFailure> => {
  if (document.errors.length > 0) return err({ kind: 'input-error', input, problems: document.errors })
  const [unread] = document.unread
  if (unread) {
    return err({
      kind: 'source-unsupported',
      input,
      source: unread.source,
      message: unread.message,
    })
  }
  return ok(document)
}

// A document with an include that lost content is not the document the author
// wrote; nothing it lacks may pass for nothing having matched.
const complete = (
  prepared: Result<PreparedDocument, string>,
  input: InputKind,
): Result<PreparedDocument, InputFailure> => {
  if (prepared.ok === false) return err({ kind: 'implementation-error', input, message: prepared.error })
  return whole(prepared.value, input)
}

export const prepareSupplied = (file: string, profile: Profile): SuppliedDocument => {
  const read = readDocument(file)
  if (read.ok === false) {
    return err({
      kind: 'source-unavailable',
      input: 'supplied',
      source: file,
      base: process.cwd(),
      message: read.error,
    })
  }
  return complete(prepareDocument(read.value, { profile }), 'supplied')
}

const isNode = (value: unknown): value is PodNode =>
  typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string'

const addressed = (
  document: PreparedDocument,
  input: InputKind,
  source: string,
  address: string | undefined,
): Result<PodNode | PodliteDocument, InputFailure> => {
  if (!address) return ok(document.tree)
  const binding = bindTarget(address, buildBindingIndex(document.tree))
  return binding.found && isNode(binding.node)
    ? ok(binding.node)
    : err({ kind: 'address-unresolved', input, source, address })
}

// The directory a source named in the test is read from: the file the test is
// written in, not the document it was included into.
const baseOf = (test: CollectedTest, env: InputEnvironment): string => {
  const holder = env.containing(test.obtainedFrom)
  return holder && test.place.file === holder.name ? holder.baseDir : path.dirname(test.place.file)
}

// One test run: fixtures are read the first time an assertion needs them, and
// what one test declares is seen by no other.
/*
=begin pod :kind<export>

=head2 inputsFor

The document each assertion of one test run is read against: the source it names,
else the supplied document, else the fixture nearest before it, else the document the
test is in. A fixture is read the first time it is needed, and the resources of the
test are seen by that fixture only.

=end pod
*/
export const inputsFor = (test: CollectedTest, context: RunContext, env: InputEnvironment) => {
  const fixtures = new Map<number, Result<PreparedDocument, InputFailure>>()
  const named = new Map<string, Result<PreparedDocument, InputFailure>>()
  const provider = resourceProvider(test.resources)

  const fixtureDocument = (fixture: FixtureDecl): Result<PreparedDocument, InputFailure> => {
    const known = fixtures.get(fixture.index)
    if (known) return known
    const name = `${test.place.file}#fixture-${fixture.index}`
    const prepared = complete(
      prepareDocument({ name, text: fixture.body, baseDir: RESOURCE_ROOT }, { profile: env.profile, provider }),
      'fixture',
    )
    fixtures.set(fixture.index, prepared)
    return prepared
  }

  const namedDocument = (source: string): Result<AssertionInput, InputFailure> => {
    const base = baseOf(test, env)
    const { scheme, document, address } = readSourceExpression(source)
    if (scheme !== 'file') {
      return err({ kind: 'source-unsupported', input: 'named', source, message: `scheme ${scheme}: is not read` })
    }
    if (hasMask(document)) {
      return err({ kind: 'source-unsupported', input: 'named', source, message: 'a mask is not read as a source' })
    }
    const file = path.resolve(base, document)
    const key = canonical(file)
    let prepared = named.get(key)
    if (!prepared) {
      const text = diskProvider.read(file)
      prepared =
        text === null
          ? err({ kind: 'source-unavailable', input: 'named', source, base, message: `cannot read ${document}` })
          : complete(
              prepareDocument({ name: key, text, baseDir: path.dirname(file), self: file }, { profile: env.profile }),
              'named',
            )
      named.set(key, prepared)
    }
    if (prepared.ok === false) return prepared
    const target = addressed(prepared.value, 'named', source, address)
    if (target.ok === false) return target
    return ok({ kind: 'named', document: prepared.value, target: target.value, source, base })
  }

  return (assert: AssertDecl): Result<AssertionInput, InputFailure> => {
    if (assert.source !== undefined) return namedDocument(assert.source)
    if (context.kind === 'supplied') {
      const supplied = env.supplied[context.document]
      if (!supplied) return err({ kind: 'implementation-error', input: 'supplied', message: 'no such document' })
      if (supplied.ok === false) return supplied
      return ok({ kind: 'supplied', document: supplied.value, target: supplied.value.tree, supplied: context.document })
    }
    if (assert.fixture) {
      const fixture = fixtureDocument(assert.fixture)
      if (fixture.ok === false) return fixture
      return ok({ kind: 'fixture', document: fixture.value, target: fixture.value.tree, fixture: assert.fixture })
    }
    const holder = env.containing(context.kind === 'containing' ? context.source : test.obtainedFrom)
    if (!holder)
      return err({ kind: 'implementation-error', input: 'containing', message: 'the source of the test is gone' })
    const checked = whole(holder, 'containing')
    if (checked.ok === false) return checked
    return ok({ kind: 'containing', document: holder, target: holder.tree })
  }
}
