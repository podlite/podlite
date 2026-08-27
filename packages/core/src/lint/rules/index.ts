import type { Rule } from '../types'
import { syntaxValidRule } from './syntax-valid'
import { headingHierarchyRule } from './heading-hierarchy'
import { idUniqueRule } from './id-unique'
import { mediaAbsoluteFileRule } from './media-absolute-file'
import { linkTargetResolvesRule } from './link-target-resolves'
import { linkFileResolvesRule } from './link-file-resolves'
import { linkNotEmptyRule } from './link-not-empty'
import { attrValueDroppedRule } from './attr-value-dropped'
import { tableShapeRule } from './table-shape'
import { deadDefinitionsRule } from './dead-definitions'

export const DEFAULT_RULES: Rule[] = [
  syntaxValidRule,
  headingHierarchyRule,
  idUniqueRule,
  mediaAbsoluteFileRule,
  linkTargetResolvesRule,
  linkFileResolvesRule,
  linkNotEmptyRule,
  attrValueDroppedRule,
  tableShapeRule,
  deadDefinitionsRule,
]
