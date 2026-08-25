// Names the specification gives a configuration option. Kept here beside the
// block names so the parser, the checker and the editor read one list rather
// than each carrying a copy of what it remembers.

// Applied uniformly to any built-in block, from the standard configuration
// options section of the specification.
export const STANDARD_ATTRIBUTE_NAMES = [
  'allow',
  'caption',
  'checked',
  'folded',
  'id',
  'lang',
  'nested',
  'numbered',
] as const

// Named by the specification for a particular block: the sources a block reads,
// the shape of a table, the cover over content.
export const BLOCK_ATTRIBUTE_NAMES = [
  'colspan',
  'columns',
  'encoding',
  'filename',
  'folded-levels',
  'header',
  'key',
  'masked',
  'mime-type',
  'notify',
  'rename',
  'rowspan',
  'src',
] as const

export const ATTRIBUTE_NAMES = [...STANDARD_ATTRIBUTE_NAMES, ...BLOCK_ATTRIBUTE_NAMES] as const

export const isStandardAttributeName = (name: string): boolean =>
  (STANDARD_ATTRIBUTE_NAMES as readonly string[]).includes(name)

export const isKnownAttributeName = (name: string): boolean => (ATTRIBUTE_NAMES as readonly string[]).includes(name)
