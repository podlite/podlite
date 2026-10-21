import { BLOCK_NAMES } from '@podlite/schema'

const DIRECTIVE_WORDS = ['begin', 'end', 'for', 'config', 'alias']

export const isStandardName = (name: string): boolean =>
  DIRECTIVE_WORDS.includes(name) || (BLOCK_NAMES as readonly string[]).includes(name) || /^(head|item)\d*$/.test(name)

// SYNOPSIS and SEE-ALSO name a section of the document; Image and Diagram name
// a block the author brought in; the rest is a name nothing here knows
export const nodeForName = (name: string): string => {
  if (isStandardName(name)) return 'PodBlockName'
  if (/^[A-Z][A-Z][A-Z0-9_-]*$/.test(name)) return 'PodSemanticBlock'
  if (/^[A-Z][a-z][a-zA-Z0-9_-]*$/.test(name)) return 'PodCustomBlock'
  return 'PodUnknownBlock'
}
