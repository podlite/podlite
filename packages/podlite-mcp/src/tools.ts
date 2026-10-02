import {
  filePathMatches,
  parse,
  parseSelector,
  runSelector,
  SelectorError,
  toHtml,
  toMarkdown,
  validatePodliteAst,
} from '@podlite/schema'
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
  // lines of information: the files whose blocks are in the document
  notes: string[]
}

// a path of the set as the set names it: no leading slash, its . and .. steps taken
const placeOf = (path: string): string => {
  const out: string[] = []
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  return out.join('/')
}

const describeProblem = (problem: IncludeProblem): string => {
  const at = problem.chain[problem.chain.length - 1]
  const line = at?.location ? `:${at.location.start.line}` : ''
  return `${at ? placeOf(at.file) : virtualFile}${line}: ${problem.message}`
}

const dirOf = (key: string): string => {
  const at = key.lastIndexOf('/')
  return at < 0 ? '' : key.slice(0, at)
}

type Assembled = {
  tree: any
  // the place of the document in the set and its text
  key: string
  text: string
}

// The set a call reads: the files given and the document itself under the name
// virtualFile, for the includes and for the sources of a selector alike. Without
// files only the document is known: an include of any other path is left in
// place, and the paths asked for are named once.
type Reading = {
  texts: Map<string, string>
  given: boolean
  sources: Sources
  origin: WeakMap<object, IncludeOrigin>
  sections: WeakMap<object, unknown>
  report: AssemblyReport
  // the files whose blocks an include brought, in the order met
  included: Set<string>
  assemble: (key: string) => Assembled
  finish: () => AssemblyReport
}

// The set of a call and its sources. Without files only the document is known: a
// path to anything else is not known, and is named once.
const openSet = (text: string, files?: Files) => {
  if (files && Object.keys(files).some(key => placeOf(key) === virtualFile)) {
    throw new Error(`files must not hold ${virtualFile}: that name is the document itself`)
  }
  const all: Files = { ...(files ?? {}), [virtualFile]: text }
  const texts = new Map(Object.keys(all).map((path): [string, string] => [placeOf(path), all[path]]))
  const asked: string[] = []
  const known = sourcesFromFiles(all)
  const sources: Sources = files
    ? known
    : {
        locate: (path, context, plain, at, scheme) => {
          const found = known.locate(path, context, plain, at, scheme)
          // only the document itself is known; a mask could name files that were not given
          if (found && !found.masked && found.sources.every(source => texts.has(placeOf(source.id)))) return found
          if (!asked.includes(path)) asked.push(path)
          return undefined
        },
        read: known.read,
      }
  return { texts, sources, asked }
}

const openReading = (text: string, files?: Files): Reading => {
  const { texts, sources, asked } = openSet(text, files)
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
  const report: AssemblyReport = { problems: [], error: false, notes: [] }
  const included = new Set<string>()
  const assemble = (key: string): Assembled => {
    const own = texts.get(key) ?? ''
    const assembled = assembleIncludes(toTree(own, key), {
      sources,
      // paths written in the file are resolved from its directory in the set
      context: dirOf(key) === '' ? '' : `/${dirOf(key)}`,
      file: key,
      self: `/${key}`,
      text: own,
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
    const tree = refreshTocs(assembled, p.parse(own, { podMode: 1 }), key, origin, carry)
    // a file is named when a block of it is in the document, not when it was read
    const visit = (node: any): void => {
      if (!node || typeof node !== 'object') return
      if (Array.isArray(node)) return node.forEach(visit)
      const from = origin.get(node)?.file
      if (files && from && placeOf(from) !== key) included.add(placeOf(from))
      visit(node.content)
    }
    visit(tree)
    return { tree, key, text: own }
  }
  const finish = (): AssemblyReport => {
    // a warning: it comes with the other warnings of the assembly, after the output
    if (asked.length) report.problems.push(`files were not given; includes not assembled: ${asked.join(', ')}`)
    if (included.size) report.notes.push(`included from files: ${[...included].join(', ')}`)
    return report
  }
  return { texts, given: Boolean(files), sources, origin, sections, report, included, assemble, finish }
}

export type RenderFormat = 'html' | 'md'

export type RenderReport = AssemblyReport & { output: string }

export const renderSource = (text: string, format: RenderFormat, files?: Files): string =>
  renderReport(text, format, files).output

export const renderReport = (text: string, format: RenderFormat, files?: Files): RenderReport => {
  const reading = openReading(text, files)
  const { tree } = reading.assemble(virtualFile)
  const out = format === 'md' ? toMarkdown({}).run(tree) : toHtml({}).run(tree)
  return { ...reading.finish(), output: out.toString() }
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

// The selector with the path of its leading source written anew: the path as the
// parser read it, after the scheme if one is written; the rest stays as written
const withSourcePath = (selector: string, written: string, path: string): string => {
  const lead = /^\s*(?:file:\s*)?/.exec(selector)?.[0] ?? ''
  return selector.slice(lead.length).startsWith(written)
    ? `${lead}${path}${selector.slice(lead.length + written.length)}`
    : selector
}

export const querySource = (selector: string, text: string, format: QueryFormat, files?: Files): QueryReport => {
  const parsed = parseSelector(selector)
  if (!parsed) {
    throw new Error(`Invalid selector: ${selector}`)
  }
  const reading = openReading(text, files)
  const { texts, origin, sections } = reading
  // an operand names one file of the set, written as it is, from the root of the set
  const readFile = (document: string): SelectorDoc[] | undefined => {
    const key = placeOf(document)
    if (!texts.has(key)) return undefined
    return [{ file: key, node: contentOf(reading.assemble(key).tree) }]
  }
  type Found = { file: string; text: string; block: PodNode }
  const found: Found[] = []
  const take = (doc: Assembled, items: ReturnType<typeof runSelector>): void => {
    for (const item of items) {
      // a source selected whole comes back as the list of its blocks; a blank line
      // between them is not a block
      if (Array.isArray(item)) {
        take(doc, item as ReturnType<typeof runSelector>)
        continue
      }
      if (item && typeof item === 'object' && (item as { type?: string }).type === 'blankline') continue
      if (item && typeof item === 'object' && !('file' in (item as object)) && !isWrapper(item)) {
        const where = origin.get(item as object)
        found.push({
          file: placeOf(where?.file ?? doc.key),
          text: where?.text ?? doc.text,
          block: item as PodNode,
        })
      }
    }
  }
  const { scheme, document, anchor } = parsed
  if (scheme === 'file' && document) {
    // the selector names its own source: the documents of the set it names are
    // read, each with its includes, and the selection runs over each of them
    const written = document
    const pattern = placeOf(written)
    const masked = /[*?]/.test(written)
    const keys = masked
      ? [...texts.keys()].filter(key => filePathMatches(`/${key}`, `/${pattern}`)).sort()
      : texts.has(pattern)
      ? [pattern]
      : []
    if (!masked && keys.length === 0) {
      throw new Error(`the source does not resolve: file:${written}${anchor ? `#${anchor}` : ''}`)
    }
    const local = withSourcePath(selector, written, pattern)
    if (keys.length === 0) {
      // nothing found, and the operands of the selection are still read
      const blank = { file: '', node: { type: 'block', name: 'root', margin: '', content: [] } } as SelectorDoc
      runSelector(local, [], { readFile, home: [blank] })
    }
    // under a mask a file without the address is passed over, as podlite query does;
    // the address is missing only if no file holds it
    let addressed = false
    for (const key of keys) {
      const doc = reading.assemble(key)
      let items: ReturnType<typeof runSelector>
      try {
        items = runSelector(local, [{ file: key, node: contentOf(doc.tree) }], { readFile })
      } catch (e) {
        if (masked && anchor && e instanceof SelectorError && e.kind === 'address') continue
        throw e
      }
      addressed = true
      take(doc, items)
    }
    if (masked && anchor && keys.length > 0 && !addressed) {
      throw new Error(`no block has the address ${anchor}: file:${written}#${anchor}`)
    }
    if (!reading.given && masked) {
      reading.report.problems.push(`files were not given; the selector's source is looked for in text only: ${written}`)
    }
    if (!keys.includes(virtualFile)) {
      reading.report.notes.push('text not used as the document of the selection: the selector names its own source')
    }
  } else {
    const doc = reading.assemble(virtualFile)
    take(doc, runSelector(selector, [{ file: virtualFile, node: contentOf(doc.tree) }], { readFile }))
  }
  const report = reading.finish()
  let output: string
  if (format === 'json') {
    output = JSON.stringify(
      found.map(m => ({ file: m.file, ...jsonBlock(m.block, sections) })),
      null,
      2,
    )
  } else if (format === 'podlite') {
    output = found
      // a block an include brought is given as its own file holds it
      .map(m => podliteText(m.block, m.text, sections).trimEnd())
      .filter(Boolean)
      .join('\n\n')
  } else {
    output = found
      .map(m => renderBlock(m.block, format))
      .filter(Boolean)
      .join('\n\n')
  }
  return { ...report, matchCount: found.length, output }
}

export const validateSource = (text: string, files?: Files): ValidateReport => {
  // the same set as render and query: without files only the document itself is
  // known, the includes of other paths are not checked, and the paths are named
  const { sources, asked } = openSet(text, files)
  const problems: Violation[] = [...scanSourceRules(text)]
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
