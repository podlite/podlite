import type { Rule } from '../types'
import { syntaxValidRule } from './syntax-valid'
import { headingHierarchyRule } from './heading-hierarchy'
import { itemHierarchyRule } from './item-hierarchy'
import { testUnderRuleRule } from './test-under-rule'
import { idUniqueRule } from './id-unique'
import { mediaAbsoluteFileRule } from './media-absolute-file'
import { linkTargetResolvesRule } from './link-target-resolves'
import { linkFileResolvesRule } from './link-file-resolves'
import { linkNotEmptyRule } from './link-not-empty'
import { attrValueDroppedRule } from './attr-value-dropped'
import { tableShapeRule } from './table-shape'
import { markupCodeTooDeepRule } from './markup-code-too-deep'
import { deadDefinitionsRule } from './dead-definitions'
import { includeResolvesRule } from './include-resolves'
import { directiveNamedBlockRule, imageNamedBlockRule } from './named-blocks'
import { notifyAttributeRule } from './notify-attribute'
import { tocTitleAttributeRule } from './toc-title-attribute'

export const DEFAULT_RULES: Rule[] = [
  syntaxValidRule,
  headingHierarchyRule,
  itemHierarchyRule,
  testUnderRuleRule,
  idUniqueRule,
  mediaAbsoluteFileRule,
  linkTargetResolvesRule,
  linkFileResolvesRule,
  linkNotEmptyRule,
  attrValueDroppedRule,
  tableShapeRule,
  markupCodeTooDeepRule,
  deadDefinitionsRule,
  includeResolvesRule,
  directiveNamedBlockRule,
  imageNamedBlockRule,
  notifyAttributeRule,
  tocTitleAttributeRule,
]
