import * as fs from 'fs'
import * as path from 'path'
import {
  getDocIDs,
  podlitePluggable,
  parseSelector,
  runSelector,
  toHtml,
  toMarkdown,
  SelectorDoc,
  SelectorError,
  PodNode,
} from '@podlite/schema'
import { diskProvider, expandMask, hasMask, resolveIncludes, IncludeOrigin, IncludeProblem } from './resolve-includes'
import { refreshTocs } from './refresh-tocs'
import { contentOf, isWrapper, jsonBlock, markSections, podliteText } from './query-blocks'

export type QueryFormat = 'podlite' | 'md' | 'html' | 'json'

export type QueryOptions = {
  selector: string
  files: string[]
  format: QueryFormat
  failOnEmpty: boolean
  quiet: boolean
  stdinContent?: string
}

type Source = { file: string; text: string; fromStdin?: boolean }

// How a query reads a document: as convert and the test runner do, each file
// parsed and then transformed by the plugins that change the tree. The diagram
// and formula plugins only render, so they are left out, and with them mermaid
// and React; the three that are needed are raised when a query runs, not when
// the module loads.
type QueryReader = { toTree: (text: string) => any; written: (text: string) => any }

const queryReader = (): QueryReader => {
  /* eslint-disable @typescript-eslint/no-var-requires */
  const { PluginRegister: markdown } = require('@podlite/markdown')
  const { PluginRegister: image } = require('@podlite/image')
  const { PluginRegister: toc } = require('@podlite/toc')
  /* eslint-enable @typescript-eslint/no-var-requires */
  const p = podlitePluggable({ plugins: { ...markdown, ...image, ...toc } })
  return {
    toTree: (text: string) => p.toAst(p.parse(text, { podMode: 1 })),
    written: (text: string) => p.parse(text, { podMode: 1 }),
  }
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

const formatBlocks = (format: QueryFormat, matches: Match[], sections: WeakMap<object, any>): string => {
  if (format === 'json') {
    // without the source, a query over several files answers "here are the
    // blocks" and drops "from where", which leaves the caller no way back to
    // the document
    return JSON.stringify(
      matches.map(m => ({ file: m.file, ...jsonBlock(m.block, sections) })),
      null,
      2,
    )
  }
  if (format === 'podlite') {
    return matches
      .map(m => podliteText(m.block, m.text, sections).trimEnd())
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
  const problems: string[] = []
  const { scheme, document, anchor } = parsed
  const shown = `${scheme}:${document}${anchor ? `#${anchor}` : ''}`
  // a selector that names a file reads it, relative to where it is written: the
  // command line; the files and the input given are not read
  const namesFile = scheme === 'file' && Boolean(document)
  let emptyMask = false
  if (namesFile && document) {
    const masked = hasMask(document)
    const written = masked ? expandMask(document, process.cwd(), diskProvider) : [document]
    for (const name of written) {
      const text = diskProvider.read(path.resolve(name))
      if (text !== null) sources.push({ file: name, text })
    }
    const given = [...(opts.stdinContent !== undefined ? ['<stdin>'] : []), ...opts.files]
    if (given.length > 0) problems.push(`the selector names its own source; not read: ${given.join(', ')}`)
    if (sources.length === 0 && !(masked && !anchor)) {
      problems.push(masked ? `no block has the address ${anchor}: ${shown}` : `the source does not resolve: ${shown}`)
      return { output: '', matchCount: 0, exitCode: 1, problems }
    }
    emptyMask = sources.length === 0
  } else {
    if (opts.stdinContent !== undefined) {
      sources.push({ file: '<stdin>', text: opts.stdinContent, fromStdin: true })
    }
    for (const f of opts.files) {
      sources.push({ file: f, text: fs.readFileSync(f, 'utf-8') })
    }
  }

  if (sources.length === 0 && !emptyMask) {
    throw new Error('No input files (and no stdin)')
  }

  // Per-source invocation preserves file context for source-slicing in podlite output
  const matches: Match[] = []
  let failed = false
  // the source and its address are those of the query: they are missing only if
  // no document answers
  let answered = false
  let addressed = false
  const onError = (problem: IncludeProblem): void => {
    failed = true
    problems.push(describe(problem))
  }
  const onWarning = (problem: IncludeProblem): void => {
    problems.push(describe(problem))
  }
  const reader = queryReader()
  const sections = new WeakMap<object, any>()
  // each file is read on its own before its includes, as convert reads it
  const toTree = (text: string): any => {
    const tree = reader.toTree(text)
    markSections(tree, sections)
    return tree
  }
  // a file an operand names is relative to where the selector is written: the
  // command line
  const readFile = (document: string): SelectorDoc[] | undefined => {
    const file = path.resolve(document)
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return undefined
    const text = fs.readFileSync(file, 'utf-8')
    const node = resolveIncludes(toTree(text), {
      baseDir: path.dirname(file),
      parse: source => toTree(source),
      file: document,
      self: file,
      text,
      onError,
      onWarning,
    })
    return [{ file: document, node: contentOf(node) }]
  }
  // a mask no file answers selects nothing, and its operands are still read
  if (emptyMask) {
    const blank: SelectorDoc = { file: '', node: toTree('') }
    try {
      runSelector(opts.selector, [], { readFile, home: [blank] })
    } catch (e) {
      if (!(e instanceof SelectorError)) throw e
      problems.push(e.message)
      return { output: '', matchCount: 0, exitCode: 1, problems }
    }
    return { output: '', matchCount: 0, exitCode: opts.failOnEmpty ? 1 : 0, problems }
  }

  for (const src of sources) {
    const origin = new WeakMap<object, IncludeOrigin>()
    const fromStdin = src.fromStdin === true
    const resolved = resolveIncludes(toTree(src.text), {
      baseDir: fromStdin ? process.cwd() : path.dirname(path.resolve(src.file)),
      parse: source => toTree(source),
      file: src.file,
      self: fromStdin ? undefined : src.file,
      text: src.text,
      origin,
      onError,
      onWarning,
    })
    // the tables of contents are made again over what the includes brought; a
    // copy keeps the section its block was read out of
    const node = refreshTocs(resolved, reader.written(src.text), src.file, origin, (from, to) => {
      const section = sections.get(from)
      if (section) sections.set(to, section)
    })
    const docs: SelectorDoc[] = [{ file: src.file, node: contentOf(node) }]
    if (scheme === 'doc' && document && !getDocIDs(docs[0]).includes(document)) continue
    answered = true
    let result: ReturnType<typeof runSelector>
    try {
      result = runSelector(opts.selector, docs, { readFile })
    } catch (e) {
      if (!(e instanceof SelectorError)) throw e
      // with an address the selection is not applied, so no operand is read
      if (anchor && e.kind === 'address') continue
      failed = true
      problems.push(`${src.file}: ${e.message}`)
      continue
    }
    if (anchor) addressed = true
    for (const item of result) {
      // what the tree adds around the written blocks is not counted as found
      if (item && typeof item === 'object' && !('file' in (item as object)) && !isWrapper(item)) {
        const where = origin.get(item)
        matches.push({
          file: where ? where.file : src.file,
          text: where ? where.text : src.text,
          block: item as PodNode,
        })
      }
    }
  }

  if (scheme === 'doc' && !answered) {
    failed = true
    problems.push(`the source does not resolve: ${shown}`)
  } else if (anchor && answered && !addressed) {
    failed = true
    problems.push(`no block has the address ${anchor}: ${shown}`)
  }

  const output = formatBlocks(opts.format, matches, sections)
  const exitCode = failed || (opts.failOnEmpty && matches.length === 0) ? 1 : 0
  return { output, matchCount: matches.length, exitCode, problems }
}
