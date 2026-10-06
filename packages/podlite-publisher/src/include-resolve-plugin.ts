import * as path from 'path'
import { getFromTree, PodNode } from '@podlite/schema'
import { assembleIncludes, podlite, writtenTree } from 'podlite'
import type { IncludeOrigin, IncludeProblem, ReadFormat } from 'podlite'
import { refreshTocs } from 'podlite/lib/refresh-tocs'
import { publishRecord } from './record'
import { PodliteWebPlugin, PodliteWebPluginContext } from './plugins'
import { catalogueOf, idOfFile } from './catalogue'
import { getParserTypeforFile, PARSER_TYPES } from './node-utils'
import { readRecordText } from './reading'
import { SITE_DATA_DOCUMENT } from './site-data-plugin'
import { nodeOriginKey, recordOrigin } from './source'
import type { NodeOrigin, RecordSource } from './source'

export type IncludeResolveOptions = {
  // the records the site read before the plugins ran, mounted sources among them:
  // what an include can bring
  catalogue?: publishRecord[]
  // directories a path written inside one of them does not lead out of
  bounds?: string[]
  // names of documents plugins make later in the chain, besides the site data
  late?: string[]
}

/*
=begin pod :kind<export>

=head2 IncludeError

An include that does not place what it names stops the build: the source or the
address is not found, the selector cannot be read, the scheme is not one the
site reads, a name answers to two documents, or a file is already on the way in.
C<problems> holds one line for each, with the file and the line of the directive.

=end pod
*/
export class IncludeError extends Error {
  readonly problems: string[]
  constructor(problems: string[]) {
    super(`an include is not placed:\n${problems.map(line => `  ${line}`).join('\n')}`)
    this.name = 'IncludeError'
    this.problems = problems
  }
}

// lose what the include names, though the assembler reports them as warnings
const stopping = new Set<IncludeProblem['kind']>(['unsupported-scheme', 'unparsed-selector', 'cycle', 'ambiguous'])

const shown = (file: string): string => (path.isAbsolute(file) ? path.relative(process.cwd(), file) : file)

const isToc = (node: any): boolean => node?.type === 'block' && (node.name === 'toc' || node.name === 'Toc')
const hasToc = (tree: unknown): boolean => getFromTree(tree as PodNode, 'toc', 'Toc').some(isToc)
const includesIn = (tree: unknown): any[] => getFromTree(tree as PodNode, 'include')

// the format a table of contents of the record is built again from; none for Markdown
const writtenFormat = (source: RecordSource): ReadFormat | undefined => {
  const type = getParserTypeforFile(source.file, source.mime)
  return type === PARSER_TYPES.MARKDOWN ? undefined : type === PARSER_TYPES.PODLITE ? 'podlite' : 'default'
}

type Pass = 'first' | 'last' | 'only'

const passes = (options: IncludeResolveOptions) => {
  const late = new Set([SITE_DATA_DOCUMENT, ...(options.late ?? [])])
  let waiting = false
  const catalogue = catalogueOf(options.catalogue ?? [], {
    bounds: options.bounds,
    parse: (text, file) => readRecordText(text, file),
    waits: name => waiting && late.has(name),
  })
  const parser = podlite({ importPlugins: true })
  // the file a directive was written in, by the place a problem shares with it
  const fileAt = new WeakMap<object, string>()

  const describe = (problem: IncludeProblem): string => {
    const steps = problem.chain.map(step => {
      const file = (step.location && fileAt.get(step.location)) || step.file
      return `${shown(file)}${step.location ? `:${step.location.start.line}` : ''}`
    })
    const at = steps.pop() ?? '<document>'
    return `${at}: ${problem.message}${steps.length ? ` (included through ${steps.reverse().join(', ')})` : ''}`
  }

  const stampOf = (where: IncludeOrigin): NodeOrigin =>
    where.via ? { file: where.file, via: where.via } : { file: where.file }

  // The file each node was written in goes onto the node itself, where a copy
  // keeps it; the assembler's own table is lost on the first copy a plugin makes.
  const stamp = (tree: unknown, origin: WeakMap<object, IncludeOrigin>) => {
    const visit = (node: any) => {
      if (!node || typeof node !== 'object') return
      if (Array.isArray(node)) return node.forEach(visit)
      const where = origin.get(node)
      if (where && !node[nodeOriginKey]) node[nodeOriginKey] = stampOf(where)
      const file = node[nodeOriginKey]?.file
      if (file && node.location && typeof node.location === 'object') fileAt.set(node.location, file)
      visit(node.content)
    }
    visit(tree)
  }

  // what the nodes say of themselves is told to the assembler, so that a block an
  // earlier pass brought is not taken for one of the record
  const seed = (tree: unknown, origin: WeakMap<object, IncludeOrigin>) => {
    const visit = (node: any) => {
      if (!node || typeof node !== 'object') return
      if (Array.isArray(node)) return node.forEach(visit)
      const mark: NodeOrigin | undefined = node[nodeOriginKey]
      if (mark) origin.set(node, { file: mark.file, text: '', ...(mark.via ? { via: mark.via } : {}) })
      visit(node.content)
    }
    visit(tree)
  }

  const run = (pass: Pass): PodliteWebPlugin => {
    const outCtx: PodliteWebPluginContext = {}
    const onExit = ctx => ({ ...ctx, ...outCtx })
    const onProcess = (recs: publishRecord[]) => {
      if (!options.catalogue && pass !== 'last') {
        console.warn(
          '[plugin: resolve ] no catalogue of the site is given; an include is looked for among the records at hand',
        )
      }
      // a document a plugin made on the way is a source too
      catalogue.add(recs)
      waiting = pass === 'first'
      const problems: string[] = []
      // directives already said why they are left in place
      const told = new WeakSet<object>()
      const fail = (problem: IncludeProblem) => {
        const at = problem.chain[problem.chain.length - 1]?.location
        if (at) told.add(at)
        problems.push(describe(problem))
      }
      const warn = (problem: IncludeProblem) => {
        if (stopping.has(problem.kind)) fail(problem)
        else console.warn(`[plugin: resolve ] ${describe(problem)}`)
      }

      // a document placed last is placed as it is: an include in it would need a third pass
      const lateFiles = new Set<string>()
      if (pass !== 'first') {
        for (const name of late) {
          for (const id of catalogue.named(name)) {
            lateFiles.add(id)
            const text = catalogue.textOf(id)
            if (text !== undefined && includesIn(readRecordText(text, id)).length) {
              problems.push(`${shown(id)}: ${name} is placed after the other plugins, so it may not hold an include`)
            }
          }
        }
        if (problems.length) throw new IncludeError(problems)
      }

      const done = new WeakMap<object, unknown>()
      // one field of a record, read from one file
      const assemble = (tree: any, record: object & { file: string }): any => {
        if (!tree || typeof tree !== 'object') return tree
        if (done.has(tree)) return done.get(tree)
        // the tables of contents are built again in the passes that place the record's
        // own text; the last one only adds documents plugins made
        if (!includesIn(tree).length && (pass === 'last' || !hasToc(tree))) return tree
        const self = catalogue.idOf(record)
        const source = recordOrigin(record)
        const file = self ?? idOfFile(record.file)
        const origin = new WeakMap<object, IncludeOrigin>()
        seed(tree, origin)
        let node = assembleIncludes(tree, {
          sources: catalogue.sources,
          context: path.dirname(file),
          parse: readRecordText,
          file,
          ...(source ? { text: source.text } : {}),
          self,
          origin,
          reportCycles: true,
          onError: fail,
          onWarning: warn,
        })
        // the record's own tables of contents reach what the includes brought
        const format = source && writtenFormat(source)
        if (source && format && hasToc(node)) {
          node = refreshTocs(node, writtenTree(parser, source.text, format), file, origin)
        }
        stamp(node, origin)
        done.set(tree, node)
        return node
      }

      const out = recs.map(record => {
        const fields: Partial<publishRecord> = {}
        for (const key of ['node', 'description', 'header', 'footer'] as const) {
          const value = record[key]
          const made = assemble(value, record)
          if (made !== value) (fields as any)[key] = made
        }
        const template = record.template
        if (template) {
          const made = done.get(template) as publishRecord | undefined
          if (made) fields.template = made
          else {
            const node = assemble(template.node, template)
            const header = assemble(template.header, template)
            const footer = assemble(template.footer, template)
            if (node !== template.node || header !== template.header || footer !== template.footer) {
              fields.template = { ...template, node, header, footer }
              done.set(template, fields.template)
            }
          }
        }
        return Object.keys(fields).length ? { ...record, ...fields } : record
      })

      if (pass !== 'first') {
        for (const record of out) {
          for (const tree of [record.node, record.description, record.header, record.footer, record.template?.node]) {
            if (!tree || typeof tree !== 'object') continue
            for (const left of includesIn(tree)) {
              if (left.location && told.has(left.location)) continue
              const file = left[nodeOriginKey]?.file ?? record.file
              const line = left.location ? `:${left.location.start.line}` : ''
              problems.push(`${shown(file)}${line}: the include is left in place`)
            }
            // a picture or a link placed now comes after the plugins that make them work
            getFromTree(tree as PodNode, () => true).forEach((node: any) => {
              const from = node?.[nodeOriginKey]?.file
              if (!from || !lateFiles.has(from)) return
              const what =
                node.type === 'image' ? 'a picture' : node.type === 'fcode' && node.name === 'L' ? 'a link' : ''
              if (what) problems.push(`${shown(from)}: ${what} is placed after the plugins that handle it`)
            })
          }
        }
      }
      if (problems.length) throw new IncludeError([...new Set(problems)])
      return out
    }
    return [onProcess, onExit]
  }
  return { run, documents: (name: string) => catalogue.named(name) }
}

/*
=begin pod :kind<export>

=head2 includePasses

The include plugin in two passes over one catalogue. C<first> goes before the
plugins of images, links and React and places all it can; an include of a
document a plugin makes later in the chain (the site data, and the names in
C<late>) waits there. C<last> goes after those plugins and places only such
documents. An include left after it stops the build. C<documents> gives the files
of the documents that answer to a name, for the links plugin to find a C<doc:>
link by the same names.

=end pod
*/
export const includePasses = (
  options: IncludeResolveOptions = {},
): { first: PodliteWebPlugin; last: PodliteWebPlugin; documents: (name: string) => string[] } => {
  const { run, documents } = passes(options)
  return { first: run('first'), last: run('last'), documents }
}

// One pass over the records: nothing waits, and an include that does not place
// what it names stops the build.
const plugin = (options: IncludeResolveOptions = {}): PodliteWebPlugin => passes(options).run('only')
export default plugin
