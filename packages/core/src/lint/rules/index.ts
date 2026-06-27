import type { Rule } from '../types'
import { syntaxValidRule } from './syntax-valid'
import { headingHierarchyRule } from './heading-hierarchy'
import { idUniqueRule } from './id-unique'
import { mediaAbsoluteFileRule } from './media-absolute-file'

export const DEFAULT_RULES: Rule[] = [syntaxValidRule, headingHierarchyRule, idUniqueRule, mediaAbsoluteFileRule]
