import type { MimeTypes } from './node-utils'

/*
=begin pod :kind<export>

=head2 RecordSource

The text a record was read from, the name it was read under and the type it was
read as. One object stands for one reading: every copy of the record holds the
same object, so two records with the same source came from one reading.

C<text> is not an enumerable property. A copy of the object made with spread or
C<Object.assign> has no C<text>; keep the object itself.

=end pod
*/
export type RecordSource = {
  readonly file: string
  readonly mime?: MimeTypes
  readonly text: string
}

type HeldSource = RecordSource & { readonly parsed: (node: unknown) => boolean }

// Symbol.for shares the key between copies of the package in one process, so the
// shape of the value is fixed by the number in the name
export const sourceKey: unique symbol = Symbol.for('@podlite/publisher:source/1')
export const originKey: unique symbol = Symbol.for('@podlite/publisher:origin/1')

type Sourced = {
  node?: unknown
  [sourceKey]?: HeldSource
  [originKey]?: HeldSource
}

// the keys stay out of the record type: a declaration that spreads a record would have to name them
const held = (record: object): Sourced => record

const hold = (file: string, text: string, mime: MimeTypes | undefined, tree: unknown): HeldSource => {
  const source = { file, ...(mime ? { mime } : {}), text, parsed: (node: unknown) => node === tree }
  Object.defineProperty(source, 'text', { enumerable: false })
  Object.defineProperty(source, 'parsed', { enumerable: false })
  return Object.freeze(source)
}

export const withSource = <T extends object>(record: T, file: string, text: string, mime?: MimeTypes): T => ({
  ...record,
  [sourceKey]: hold(file, text, mime, held(record).node),
})

export const withOrigin = <T extends object>(record: T, from: object): T => {
  const origin = held(from)[originKey] ?? held(from)[sourceKey]
  return origin ? { ...record, [originKey]: origin } : record
}

/*
=begin pod :kind<export>

=head2 recordSource

The source of a record that was read from a text, and of every copy of it. A
record a plugin built out of parts of another one has no source of its own; see
C<recordOrigin>. A plugin that replaces the tree of a record leaves the source
in place, so having a source does not mean the tree still matches it; see
C<isParsedTree>.

=end pod
*/
export const recordSource = (record: object): RecordSource | undefined => held(record)[sourceKey]

/*
=begin pod :kind<export>

=head2 recordOrigin

The reading a record comes from: its own source, or the source of the record it
was cut from. Several records cut from one file share one origin. An origin is
not a text the record can be read again from.

=end pod
*/
export const recordOrigin = (record: object): RecordSource | undefined =>
  held(record)[originKey] ?? held(record)[sourceKey]

/*
=begin pod :kind<export>

=head2 isParsedTree

Whether the tree of the record is the very object its source was parsed into.
A tree changed in place still answers yes.

=end pod
*/
export const isParsedTree = (record: object): boolean => held(record)[sourceKey]?.parsed(held(record).node) ?? false
