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

export const isVerbatimBlock = (name: string): boolean => (VERBATIM_BLOCKS as readonly string[]).includes(name)

export const isKnownBlockName = (name: string): boolean => (BLOCK_NAMES as readonly string[]).includes(name)
