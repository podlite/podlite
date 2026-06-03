import type { Rule } from '../types'
import { headingHierarchyRule } from './heading-hierarchy'
import { idUniqueRule } from './id-unique'

export const DEFAULT_RULES: Rule[] = [headingHierarchyRule, idUniqueRule]
