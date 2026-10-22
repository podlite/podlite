/*
=begin pod

=TITLE How far an alias is expanded

C<A<>> is replaced by the text of its alias, and that text is read and walked
again, so an alias may name another one, or itself. One use of C<A<>> in a text
starts an expansion; the expansions inside it share its state. An alias already
on the way is a cycle; a chain deeper than C<ALIAS_EXPANSION_DEPTH> or more
than C<ALIAS_EXPANSION_BUDGET> replacements in one expansion stops it. What is
refused is written as C<A<name>>, as an alias that is not defined, and is told
once per expansion.

A footnote walks its content later, when the expansion it stands in is over; it
starts an expansion of its own.

=end pod
*/

export const ALIAS_EXPANSION_DEPTH = 8
export const ALIAS_EXPANSION_BUDGET = 10000

type Expansion = { chain: string[]; spent: number; told: boolean }

const KEY = 'aliasExpansion'

// Expands `term` through `walk` when the limits let it, and returns true; returns
// false when it is refused, after telling why once per expansion. The state lives
// on ctx, so copies of ctx made inside the walk share it.
export const expandAlias = <T>(
  ctx: { [key: string]: any },
  term: string,
  walk: () => T,
  warn: (message: string) => void,
): { expanded: true; result: T } | { expanded: false } => {
  const open: Expansion | undefined = ctx[KEY]
  const state: Expansion = open && open.chain.length ? open : { chain: [], spent: 0, told: false }
  const refuse = (message: string): { expanded: false } => {
    if (!state.told) warn(message)
    state.told = true
    return { expanded: false }
  }
  if (state.chain.includes(term)) {
    return refuse(`alias ${term} expands into itself: ${[...state.chain, term].join(' → ')}`)
  }
  if (state.chain.length >= ALIAS_EXPANSION_DEPTH) {
    return refuse(
      `alias ${term} expands deeper than ${ALIAS_EXPANSION_DEPTH} levels: ${state.chain.join(' → ')} → ${term}`,
    )
  }
  if (state.spent >= ALIAS_EXPANSION_BUDGET) {
    return refuse(`alias expansion ${state.chain[0] ?? term} makes more than ${ALIAS_EXPANSION_BUDGET} replacements`)
  }
  state.spent++
  state.chain.push(term)
  ctx[KEY] = state
  try {
    return { expanded: true, result: walk() }
  } finally {
    state.chain.pop()
  }
}
