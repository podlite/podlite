import { getFromTree, PodliteDocument } from '@podlite/schema'
import type { Rule, Violation, LintContext } from '../types'

export const DIRECTIVE_NAMED_BLOCK_RULE_ID = 'directive-named-block'
export const IMAGE_NAMED_BLOCK_RULE_ID = 'image-named-block'

const DIRECTIVES = ['include', 'set', 'config', 'alias']

type NamedNode = { type?: string; name?: string; location?: Violation['location'] }

// a name with both cases is a named block for a handler; all upper case is a semantic block
const isMixedCase = (name: string): boolean => name !== name.toLowerCase() && name !== name.toUpperCase()

const blocksNamed = (ast: PodliteDocument, test: (name: string) => boolean): NamedNode[] =>
  (getFromTree(ast, () => true) as NamedNode[]).filter(
    node => node.type === 'block' && typeof node.name === 'string' && test(node.name),
  )

export const directiveNamedBlockRule: Rule = {
  id: DIRECTIVE_NAMED_BLOCK_RULE_ID,
  severity: 'warning',
  check: (ast: PodliteDocument, _ctx: LintContext): Violation[] =>
    blocksNamed(ast, name => isMixedCase(name) && DIRECTIVES.includes(name.toLowerCase())).map(node => ({
      rule: DIRECTIVE_NAMED_BLOCK_RULE_ID,
      severity: 'warning',
      message: `=${node.name} is a named block, not a directive; the directive is written =${String(
        node.name,
      ).toLowerCase()}`,
      location: node.location,
    })),
}

export const imageNamedBlockRule: Rule = {
  id: IMAGE_NAMED_BLOCK_RULE_ID,
  severity: 'warning',
  check: (ast: PodliteDocument, _ctx: LintContext): Violation[] =>
    blocksNamed(ast, name => name === 'Image').map(node => ({
      rule: IMAGE_NAMED_BLOCK_RULE_ID,
      severity: 'warning',
      message: '=Image is not in the specification; a picture is written =picture',
      location: node.location,
    })),
}
