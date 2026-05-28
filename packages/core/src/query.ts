import * as fs from 'fs'
import { parse, parseSelector, runSelector, toHtml, toMarkdown, SelectorDoc, PodNode } from '@podlite/schema'

export type QueryFormat = 'podlite' | 'md' | 'html' | 'json'

export type QueryOptions = {
  selector: string
  files: string[]
  format: QueryFormat
  failOnEmpty: boolean
  quiet: boolean
  stdinContent?: string
}

type Source = { file: string; text: string; node: any }

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

const formatBlocks = (format: QueryFormat, matches: Array<{ source: Source; block: PodNode }>): string => {
  if (format === 'json') {
    return JSON.stringify(
      matches.map(m => m.block),
      null,
      2,
    )
  }
  if (format === 'podlite') {
    return matches
      .map(m => sliceBlock(m.source.text, m.block).trimEnd())
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
}

export const runQuery = (opts: QueryOptions): QueryResult => {
  const parsed = parseSelector(opts.selector)
  if (!parsed) {
    throw new Error(`Invalid selector: ${opts.selector}`)
  }

  const sources: Source[] = []
  if (opts.stdinContent !== undefined) {
    sources.push({ file: '<stdin>', text: opts.stdinContent, node: parse(opts.stdinContent) })
  }
  for (const f of opts.files) {
    sources.push(loadSource(f))
  }

  if (sources.length === 0) {
    throw new Error('No input files (and no stdin)')
  }

  // Per-source invocation preserves file context for source-slicing in podlite output
  const matches: Array<{ source: Source; block: PodNode }> = []
  for (const src of sources) {
    const docs: SelectorDoc[] = [{ file: src.file, node: src.node }]
    const result = runSelector(opts.selector, docs)
    for (const item of result) {
      if (item && typeof item === 'object' && !('file' in (item as object))) {
        matches.push({ source: src, block: item as PodNode })
      }
    }
  }

  const output = formatBlocks(opts.format, matches)
  const exitCode = opts.failOnEmpty && matches.length === 0 ? 1 : 0
  return { output, matchCount: matches.length, exitCode }
}
