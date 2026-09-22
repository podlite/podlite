import * as path from 'path'
import { parseSelector, runSelector, SelectorError } from '@podlite/schema'
import type { Location } from '@podlite/schema'
import { splitSource } from './collect'
import type { Profile } from './documents'
import { RESOURCE_ROOT } from './resources'
import type { AssertionInput, InputFailure, InputKind } from './sources'
import type { AssertDecl, Place, Result } from './types'

export type AssertionReason =
  | { kind: 'assertion-false' }
  | { kind: 'unsupported-selector'; selector: string }
  | { kind: 'operand-unresolved'; error: SelectorError['kind']; message: string }
  | InputFailure

export type Evidence = {
  name: string
  file: string
  location?: Location
  // 'section': the block was read out of a Markdown section, whose own place is
  // given; the reader keeps no exact place for what it finds inside
  precision?: 'section'
}

/*
=begin pod :kind<export>

=head2 AssertionResult

One assertion checked: whether it holds, the document it was read against, the
blocks it found with the file each is written in, and the reason when it does not
hold. C<matches> is absent when the selection never ran.

=end pod
*/
export type AssertionResult = {
  index: number
  expression: string
  absent: boolean
  caption?: string
  place: Place
  held: boolean
  input?: {
    kind: InputKind
    document: string
    source?: string
    base?: string
    fixture?: Place
  }
  // present only when the selection ran: a document that could not be read
  // has no count, not a count of nothing
  matches?: number
  evidence: Evidence[]
  reason?: AssertionReason
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const isLocation = (value: unknown): value is Location =>
  isObject(value) && isObject(value.start) && typeof value.start.offset === 'number'

// A resource lives in no directory of the disk; it is shown by the name the
// test gave it.
const shownFile = (file: string): string => {
  const rel = path.relative(RESOURCE_ROOT, file)
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? `resource:${rel.split(path.sep).join('/')}` : file
}

export const selectionOf = (expression: string): string => splitSource(expression).selection

// A selection the implementation cannot read is not a selection of nothing:
// under :absent that would pass for a test that never looked.
const usable = (selection: string, profile: Profile): boolean =>
  selection === '' || (parseSelector(selection) !== undefined && (profile.supports?.(selection) ?? true))

const describeInput = (input: AssertionInput): AssertionResult['input'] => ({
  kind: input.kind,
  document: input.document.name,
  source: input.source,
  base: input.base,
  fixture: input.fixture?.place,
})

/*
=begin pod :kind<export>

=head2 evaluateAssertion

Runs one assertion over the input C<inputsFor> resolved for it. A selection the
profile cannot run and an input that could not be read both fail the assertion,
C<:absent> or not: neither is a document in which nothing matched.

=end pod
*/
export const evaluateAssertion = (
  assert: AssertDecl,
  input: Result<AssertionInput, InputFailure>,
  profile: Profile,
): AssertionResult => {
  const base = {
    index: assert.index,
    expression: assert.expression,
    absent: assert.absent,
    caption: assert.caption,
    place: assert.place,
  }
  const selection = selectionOf(assert.expression)
  if (!usable(selection, profile)) {
    return {
      ...base,
      held: false,
      input: input.ok === true ? describeInput(input.value) : undefined,
      evidence: [],
      reason: { kind: 'unsupported-selector', selector: selection },
    }
  }
  if (input.ok === false) return { ...base, held: false, evidence: [], reason: input.error }
  const { document, target, readFile } = input.value
  let blocks: Array<Record<string, unknown>>
  try {
    // the current document of the selection is the one the assertion is read against
    const home = [{ file: document.name, node: document.tree }]
    const found: unknown[] =
      selection === '' ? [target] : runSelector(selection, [{ file: document.name, node: target }], { home, readFile })
    // a selection may hand back a document it was given; only blocks count
    blocks = found.filter((item): item is Record<string, unknown> => isObject(item) && !('file' in item))
  } catch (e) {
    if (e instanceof SelectorError) {
      return {
        ...base,
        held: false,
        input: describeInput(input.value),
        evidence: [],
        reason: { kind: 'operand-unresolved', error: e.kind, message: e.message },
      }
    }
    const message = e instanceof Error ? e.message : String(e)
    return {
      ...base,
      held: false,
      input: describeInput(input.value),
      evidence: [],
      reason: { kind: 'implementation-error', input: input.value.kind, message },
    }
  }
  const evidence = blocks.map((block): Evidence => {
    const section = document.sections.get(block)
    const placed = section ?? block
    const where = document.origin.get(placed)
    return {
      name: typeof block.name === 'string' ? block.name : String(block.type),
      file: shownFile(where ? document.identify(where.file) : document.name),
      location: isLocation(placed.location) ? placed.location : undefined,
      ...(section ? { precision: 'section' } : {}),
    }
  })
  const held = assert.absent ? blocks.length === 0 : blocks.length > 0
  return {
    ...base,
    held,
    input: describeInput(input.value),
    matches: blocks.length,
    evidence,
    reason: held ? undefined : { kind: 'assertion-false' },
  }
}
