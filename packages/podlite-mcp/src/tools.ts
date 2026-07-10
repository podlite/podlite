import { parse, parseSelector, runSelector, toHtml, toMarkdown, validatePodliteAst } from '@podlite/schema'
import type { PodNode, SelectorDoc } from '@podlite/schema'
import { podlite } from 'podlite'
import { scanSourceRules } from 'podlite/lib/lint/grammar/scan'
import { DEFAULT_RULES } from 'podlite/lib/lint/rules/index'
import { runRules } from 'podlite/lib/lint/engine'
import { parseContent } from 'podlite/lib/lint/loader'
import { makeSyntaxViolation } from 'podlite/lib/lint/rules/syntax-valid'
import type { LintContext, Violation } from 'podlite/lib/lint/types'

export type ValidateReport = {
  ok: boolean
  counts: { error: number; warning: number; info: number }
  problems: Violation[]
}

const virtualFile = 'input.podlite'

export const parseSource = (text: string) => parse(text)

export type RenderFormat = 'html' | 'md'

export const renderSource = (text: string, format: RenderFormat): string => {
  const p = podlite({ importPlugins: true })
  const tree = p.toAst(p.parse(text, { podMode: 1 }))
  const out = format === 'md' ? toMarkdown({}).run(tree) : toHtml({}).run(tree)
  return out.toString()
}

export type QueryFormat = 'podlite' | 'json' | 'html' | 'md'

export type QueryReport = {
  matchCount: number
  output: string
}

const sliceBlock = (text: string, block: PodNode): string => {
  const loc = (block as { location?: { start?: { offset?: number }; end?: { offset?: number } } }).location
  if (typeof loc?.start?.offset !== 'number' || typeof loc?.end?.offset !== 'number') {
    return ''
  }
  return text.slice(loc.start.offset, loc.end.offset)
}

const renderBlock = (block: PodNode, format: 'html' | 'md'): string => {
  const root = { type: 'block', name: 'pod', margin: '', content: [block] } as unknown as PodNode
  const out = format === 'md' ? toMarkdown({}).run(root) : toHtml({}).run(root)
  return out.toString().trimEnd()
}

export const querySource = (selector: string, text: string, format: QueryFormat): QueryReport => {
  if (!parseSelector(selector)) {
    throw new Error(`Invalid selector: ${selector}`)
  }
  const docs: SelectorDoc[] = [{ file: virtualFile, node: parse(text) }]
  const blocks: PodNode[] = []
  for (const item of runSelector(selector, docs)) {
    if (item && typeof item === 'object' && !('file' in (item as object))) {
      blocks.push(item as PodNode)
    }
  }
  let output: string
  if (format === 'json') {
    output = JSON.stringify(blocks, null, 2)
  } else if (format === 'podlite') {
    output = blocks
      .map(b => sliceBlock(text, b).trimEnd())
      .filter(Boolean)
      .join('\n\n')
  } else {
    output = blocks
      .map(b => renderBlock(b, format))
      .filter(Boolean)
      .join('\n\n')
  }
  return { matchCount: blocks.length, output }
}

export const validateSource = (text: string): ValidateReport => {
  const problems: Violation[] = [...scanSourceRules(text)]
  try {
    const ast = parseContent(text, 'podlite')
    const ctx: LintContext = { filePath: virtualFile, fileType: 'podlite', config: {} }
    problems.push(...runRules(ast, DEFAULT_RULES, ctx))
    for (const err of validatePodliteAst(ast)) {
      problems.push({
        rule: 'schema-valid',
        severity: 'error',
        message: [err.instancePath, err.message].filter(Boolean).join(' '),
      })
    }
  } catch (e) {
    problems.push(makeSyntaxViolation(e, virtualFile))
  }
  const counts = { error: 0, warning: 0, info: 0 }
  for (const p of problems) counts[p.severity] += 1
  return { ok: counts.error === 0, counts, problems }
}
