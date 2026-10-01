import { parse, parseSelector, runSelector, toHtml, toMarkdown, validatePodliteAst } from '@podlite/schema'
import type { ConfigScope, PodNode, SelectorDoc } from '@podlite/schema'
import { podlite, readerFor } from 'podlite'
import { assembleIncludes, sourcesFromFiles } from 'podlite'
import type { IncludeOrigin, IncludeProblem, Sources } from 'podlite'
import { refreshTocs } from 'podlite/lib/refresh-tocs'
import { detectFileType } from 'podlite/lib/lint/loader'
import { scanSourceRules } from 'podlite/lib/lint/grammar/scan'
import { DEFAULT_RULES } from 'podlite/lib/lint/rules/index'
import { runRules } from 'podlite/lib/lint/engine'
import { parseContent } from 'podlite/lib/lint/loader'
import { makeSyntaxViolation } from 'podlite/lib/lint/rules/syntax-valid'
import { contentOf, isWrapper, jsonBlock, markSections, podliteText } from 'podlite/lib/query-blocks'
import type { LintContext, Violation } from 'podlite/lib/lint/types'

export type ValidateReport = {
  ok: boolean
  counts: { error: number; warning: number; info: number }
  problems: Violation[]
}

const virtualFile = 'input.podlite'

export const parseSource = (text: string) => parse(text)

// The texts the caller gives by path. The document stands at the root of the set
// under the name virtualFile; paths written in it are relative to that root.
export type Files = Record<string, string>

// What assembling the includes of a document came to, besides the tree
export type AssemblyReport = {
  // the problems of the assembly, one line each, in the order met
  problems: string[]
  // a problem lost included content
  error: boolean
  // lines of information: the files included, or the paths that were asked for
  // when no files were given
  notes: string[]
}

// a path of the set as the set names it: no leading slash, no . steps
const placeOf = (path: string): string =>
  path
    .split('/')
    .filter(part => part !== '' && part !== '.')
    .join('/')

const describeProblem = (problem: IncludeProblem): string => {
  const at = problem.chain[problem.chain.length - 1]
  const line = at?.location ? `:${at.location.start.line}` : ''
  return `${at ? placeOf(at.file) : virtualFile}${line}: ${problem.message}`
}

type Assembled = {
  tree: any
  origin: WeakMap<object, IncludeOrigin>
  sections: WeakMap<object, unknown>
  report: AssemblyReport
}

// Without files the sources are not known: an include is left in place and the
// paths asked for are named once. With files the set is the only source, and
// the files included are named.
const assemble = (text: string, files?: Files): Assembled => {
  if (files && Object.keys(files).some(key => placeOf(key) === virtualFile)) {
    throw new Error(`files must not hold ${virtualFile}: that name is the document itself`)
  }
  const p = podlite({ importPlugins: true })
  const read = readerFor(p, { format: detectFileType })
  const sections = new WeakMap<object, unknown>()
  const origin = new WeakMap<object, IncludeOrigin>()
  const toTree = (source: string, file: string, config?: ConfigScope) => {
    const tree = read(source, file, config)
    markSections(tree, sections)
    return tree
  }
  const carry = (from: object, to: object): void => {
    if (sections.has(from)) sections.set(to, sections.get(from))
  }
  const asked: string[] = []
  const included = new Set<string>()
  const given = files ? sourcesFromFiles(files) : undefined
  const sources: Sources = given
    ? {
        locate: (...args) => given.locate(...args),
        read: source => {
          const found = given.read(source)
          if (typeof found === 'string') included.add(placeOf(source.id))
          return found
        },
      }
    : {
        locate: path => {
          if (!asked.includes(path)) asked.push(path)
          return undefined
        },
        read: () => undefined,
      }
  const report: AssemblyReport = { problems: [], error: false, notes: [] }
  const assembled = assembleIncludes(toTree(text, virtualFile), {
    sources,
    context: '',
    file: virtualFile,
    self: `/${virtualFile}`,
    text,
    parse: toTree,
    origin,
    onCopy: carry,
    tolerant: true,
    onError: problem => {
      report.error = true
      report.problems.push(describeProblem(problem))
    },
    onWarning: problem => report.problems.push(describeProblem(problem)),
  })
  const tree = refreshTocs(assembled, p.parse(text, { podMode: 1 }), virtualFile, origin, carry)
  if (asked.length) report.notes.push(`files were not given; includes not assembled: ${asked.join(', ')}`)
  if (included.size) report.notes.push(`included from files: ${[...included].join(', ')}`)
  return { tree, origin, sections, report }
}

export type RenderFormat = 'html' | 'md'

export type RenderReport = AssemblyReport & { output: string }

export const renderSource = (text: string, format: RenderFormat, files?: Files): RenderReport => {
  const { tree, report } = assemble(text, files)
  const out = format === 'md' ? toMarkdown({}).run(tree) : toHtml({}).run(tree)
  return { ...report, output: out.toString() }
}

export type QueryFormat = 'podlite' | 'json' | 'html' | 'md'

export type QueryReport = AssemblyReport & {
  matchCount: number
  output: string
}

const renderBlock = (block: PodNode, format: 'html' | 'md'): string => {
  const root = { type: 'block', name: 'pod', margin: '', content: [block] } as unknown as PodNode
  const out = format === 'md' ? toMarkdown({}).run(root) : toHtml({}).run(root)
  return out.toString().trimEnd()
}

export const querySource = (selector: string, text: string, format: QueryFormat, files?: Files): QueryReport => {
  if (!parseSelector(selector)) {
    throw new Error(`Invalid selector: ${selector}`)
  }
  // the tree convert reads, so a Markdown section is read into blocks
  const { tree, origin, sections, report } = assemble(text, files)
  const docs: SelectorDoc[] = [{ file: virtualFile, node: contentOf(tree) }]
  const blocks: PodNode[] = []
  for (const item of runSelector(selector, docs)) {
    if (item && typeof item === 'object' && !('file' in (item as object)) && !isWrapper(item)) {
      blocks.push(item as PodNode)
    }
  }
  let output: string
  if (format === 'json') {
    output = JSON.stringify(
      blocks.map(b => jsonBlock(b, sections)),
      null,
      2,
    )
  } else if (format === 'podlite') {
    output = blocks
      // a block an include brought is given as its own file holds it
      .map(b => podliteText(b, origin.get(b as object)?.text ?? text, sections).trimEnd())
      .filter(Boolean)
      .join('\n\n')
  } else {
    output = blocks
      .map(b => renderBlock(b, format))
      .filter(Boolean)
      .join('\n\n')
  }
  return { ...report, matchCount: blocks.length, output }
}

export const validateSource = (text: string, files?: Files): ValidateReport => {
  if (files && Object.keys(files).some(key => placeOf(key) === virtualFile)) {
    throw new Error(`files must not hold ${virtualFile}: that name is the document itself`)
  }
  const problems: Violation[] = [...scanSourceRules(text)]
  // without files the includes are not checked, and the paths asked for are named
  const asked: string[] = []
  const sources: Sources = files
    ? sourcesFromFiles(files)
    : {
        locate: path => {
          if (!asked.includes(path)) asked.push(path)
          return undefined
        },
        read: () => undefined,
      }
  try {
    const ast = parseContent(text, 'podlite')
    const ctx: LintContext = {
      filePath: virtualFile,
      fileType: 'podlite',
      config: {},
      source: text,
      sources,
      context: '',
      self: `/${virtualFile}`,
    }
    problems.push(...runRules(ast, DEFAULT_RULES, ctx))
    if (asked.length) {
      problems.push({
        rule: 'include-resolves',
        severity: 'info',
        message: `files were not given; includes not checked: ${asked.join(', ')}`,
      })
    }
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
