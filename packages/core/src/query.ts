import * as fs from 'fs'
import * as path from 'path'
import { parse, parseSelector, runSelector, toHtml, toMarkdown, SelectorDoc, PodNode } from '@podlite/schema'
import { resolveIncludes, IncludeOrigin, IncludeProblem } from './resolve-includes'

export type QueryFormat = 'podlite' | 'md' | 'html' | 'json'

export type QueryOptions = {
  selector: string
  files: string[]
  format: QueryFormat
  failOnEmpty: boolean
  quiet: boolean
  stdinContent?: string
}

type Source = { file: string; text: string; node: any; fromStdin?: boolean }

const loadSource = (file: string): Source => {
  const text = fs.readFileSync(file, 'utf-8')
  return { file, text, node: parse(text) }
}

const sliceBlock = (text: string, block: any): string => {
  const loc = block?.location
  if (!loc || typeof loc.start?.offset !== 'number' || typeof loc.end?.offset !== 'number') {
    return ''
  }
  return text.slice(loc.start.offset, loc.end.offset)
}

// Each block is rendered through its own pod-block invocation. Wrapping
// multiple matches into one synthetic container triggers serializer
// warnings on some exporters; per-block keeps output clean.
const renderViaRoot = (block: PodNode, serializer: 'md' | 'html'): string => {
  const root: any = { type: 'block', name: 'pod', margin: '', content: [block] }
  const out = serializer === 'md' ? toMarkdown({}).run(root) : toHtml({}).run(root)
  return out.toString()
}

// A block brought in by =include is written in another file: its text and its
// offsets belong to that file.
type Match = { file: string; text: string; block: PodNode }

const formatBlocks = (format: QueryFormat, matches: Match[]): string => {
  if (format === 'json') {
    // without the source, a query over several files answers "here are the
    // blocks" and drops "from where", which leaves the caller no way back to
    // the document
    return JSON.stringify(
      matches.map(m => ({ file: m.file, ...(m.block as object) })),
      null,
      2,
    )
  }
  if (format === 'podlite') {
    return matches
      .map(m => sliceBlock(m.text, m.block).trimEnd())
      .filter(Boolean)
      .join('\n\n')
  }
  if (format === 'md' || format === 'html') {
    return matches
      .map(m => renderViaRoot(m.block, format).trimEnd())
      .filter(Boolean)
      .join('\n\n')
  }
  throw new Error(`Unknown output format: ${format}`)
}

export type QueryResult = {
  output: string
  matchCount: number
  exitCode: number
  // includes that could not be resolved, and addresses that name two blocks
  problems: string[]
}

const describe = (problem: IncludeProblem): string => {
  const at = problem.chain[problem.chain.length - 1]
  const line = at?.location ? `:${at.location.start.line}` : ''
  const file = at ? (path.isAbsolute(at.file) ? path.relative(process.cwd(), at.file) : at.file) : '<document>'
  return `${file}${line}: ${problem.message}`
}

export const runQuery = (opts: QueryOptions): QueryResult => {
  const parsed = parseSelector(opts.selector)
  if (!parsed) {
    throw new Error(`Invalid selector: ${opts.selector}`)
  }

  const sources: Source[] = []
  if (opts.stdinContent !== undefined) {
    sources.push({ file: '<stdin>', text: opts.stdinContent, node: parse(opts.stdinContent), fromStdin: true })
  }
  for (const f of opts.files) {
    sources.push(loadSource(f))
  }

  if (sources.length === 0) {
    throw new Error('No input files (and no stdin)')
  }

  // Per-source invocation preserves file context for source-slicing in podlite output
  const matches: Match[] = []
  const problems: string[] = []
  let failed = false
  for (const src of sources) {
    const origin = new WeakMap<object, IncludeOrigin>()
    const fromStdin = src.fromStdin === true
    const node = resolveIncludes(src.node, {
      baseDir: fromStdin ? process.cwd() : path.dirname(path.resolve(src.file)),
      parse: source => parse(source),
      file: src.file,
      self: fromStdin ? undefined : src.file,
      text: src.text,
      origin,
      onError: problem => {
        failed = true
        problems.push(describe(problem))
      },
      onWarning: problem => problems.push(describe(problem)),
    })
    const docs: SelectorDoc[] = [{ file: src.file, node }]
    const result = runSelector(opts.selector, docs)
    for (const item of result) {
      if (item && typeof item === 'object' && !('file' in (item as object))) {
        const where = origin.get(item)
        matches.push({
          file: where ? where.file : src.file,
          text: where ? where.text : src.text,
          block: item as PodNode,
        })
      }
    }
  }

  const output = formatBlocks(opts.format, matches)
  const exitCode = failed || (opts.failOnEmpty && matches.length === 0) ? 1 : 0
  return { output, matchCount: matches.length, exitCode, problems }
}
