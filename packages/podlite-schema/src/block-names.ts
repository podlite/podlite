// Names the parser treats as blocks. Kept here so the parser, the linter and the
// editor read one list instead of each carrying a copy.
export const BLOCK_NAMES = [
  'boundary',
  'cell',
  'code',
  'comment',
  'data',
  'data-table',
  'defn',
  'formula',
  'head',
  'include',
  'input',
  'item',
  'markdown',
  'nested',
  'output',
  'para',
  'picture',
  'pod',
  'row',
  'set',
  'table',
  'toc',
] as const

// Blocks whose content is taken as written, so nothing inside them is markup.
// The formatting-codes plugin keeps a narrower list of its own — the two answer
// different questions and are reconciled separately.
export const VERBATIM_BLOCKS = [
  'code',
  'comment',
  'data',
  'data-table',
  'formula',
  'input',
  'markdown',
  'output',
  'picture',
  'table',
] as const

// A name carrying both cases is a named block: the specification hands its body
// to a renderer or a parser plug-in, and without one the body degrades to
// verbatim. So a =begin written inside it is content, not structure — the same
// answer the listed names give, reached by a different road.
export const isNamedBlockName = (name: string): boolean => /[a-z]/.test(name) && /[A-Z]/.test(name)

export const isVerbatimBlock = (name: string): boolean =>
  (VERBATIM_BLOCKS as readonly string[]).includes(name) || isNamedBlockName(name)

export const isKnownBlockName = (name: string): boolean => (BLOCK_NAMES as readonly string[]).includes(name)
