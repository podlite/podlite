import type { Rule } from '../types'
import { syntaxValidRule } from './syntax-valid'
import { headingHierarchyRule } from './heading-hierarchy'
import { idUniqueRule } from './id-unique'
import { mediaAbsoluteFileRule } from './media-absolute-file'
import { linkTargetResolvesRule } from './link-target-resolves'
import { attrValueDroppedRule } from './attr-value-dropped'

export const DEFAULT_RULES: Rule[] = [
  syntaxValidRule,
  headingHierarchyRule,
  idUniqueRule,
  mediaAbsoluteFileRule,
  linkTargetResolvesRule,
  attrValueDroppedRule,
]
