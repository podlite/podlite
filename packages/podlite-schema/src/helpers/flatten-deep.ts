export type Nested<T> = T | ReadonlyArray<Nested<T>>

const isList = <T>(item: Nested<T>): item is ReadonlyArray<Nested<T>> => Array.isArray(item)

/*
=begin pod :kind<export>

=head2 flattenDeep

Puts the items of nested lists into one list, in order, in time that grows with
the number of items. Holes of a list are skipped. A value that is not a list is
taken the way C<concat> takes it: an object marked with
C<Symbol.isConcatSpreadable> gives its items one level deep, holes kept.

=end pod
*/
export function flattenDeep<T>(items: ReadonlyArray<Nested<T>>): T[] {
  const out: T[] = []
  const walk = (list: ReadonlyArray<Nested<T>>): void =>
    list.forEach(item => {
      if (isList(item)) return walk(item)
      // concat on an empty list spreads what concat spreads, and copies nothing
      const empty: T[] = []
      const parts = empty.concat(item)
      for (let i = 0; i < parts.length; i++) {
        if (Object.prototype.hasOwnProperty.call(parts, i)) out.push(parts[i])
        else out.length++
      }
    })
  walk(items)
  return out
}
