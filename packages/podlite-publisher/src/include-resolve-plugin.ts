import * as path from 'path'
import { getFromTree } from '@podlite/schema'
import type { Location, PodliteDocument } from '@podlite/schema'
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

/*
=begin pod :kind<export>

=head2 IncludeResolveOptions

C<catalogue> is what an include finds its source in: the records the site read
before the plugins ran, mounted sources among them. Documents plugins make
later in the chain are added as they come. C<bounds> are directories a path written inside
one of them may not lead out of. C<late> names documents plugins make later in
the chain, besides the site data: an include of one waits for the last pass.

=end pod
*/
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

The build stops when an include cannot place what it names:

=item the source or the address is not found;
=item the selector cannot be read;
=item the scheme is not one the site reads;
=item a name answers to two documents;
=item a file includes itself, directly or through other files.

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

// a node of a tree as the walks here read it
type TreeNode = {
  type?: string
  name?: string
  content?: unknown
  location?: Location
  [nodeOriginKey]?: NodeOrigin
}

const isNode = (value: unknown): value is TreeNode =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const nodesOf = (tree: unknown, ...queries: Array<string | ((node: unknown) => boolean)>): TreeNode[] =>
  getFromTree(tree, ...queries).flatMap(node => (isNode(node) ? [node] : []))

const isToc = (node: TreeNode): boolean => node.type === 'block' && (node.name === 'toc' || node.name === 'Toc')
const hasToc = (tree: unknown): boolean => nodesOf(tree, 'toc', 'Toc').some(isToc)

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
    const visit = (node: unknown) => {
      if (Array.isArray(node)) return node.forEach(visit)
      if (!isNode(node)) return
      const where = origin.get(node)
      if (where && !node[nodeOriginKey]) node[nodeOriginKey] = stampOf(where)
      const file = node[nodeOriginKey]?.file
      if (file && isNode(node.location)) fileAt.set(node.location, file)
      visit(node.content)
    }
    visit(tree)
  }

  // what the nodes say of themselves is told to the assembler, so that a block an
  // earlier pass brought is not taken for one of the record
  const seed = (tree: unknown, origin: WeakMap<object, IncludeOrigin>) => {
    const visit = (node: unknown) => {
      if (Array.isArray(node)) return node.forEach(visit)
      if (!isNode(node)) return
      const mark = node[nodeOriginKey]
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
      // a document a plugin made earlier in the chain is a source too
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
            if (text !== undefined && nodesOf(readRecordText(text, id), 'include').length) {
              problems.push(`${shown(id)}: ${name} is placed after the other plugins, so it may not hold an include`)
            }
          }
        }
        if (problems.length) throw new IncludeError(problems)
      }

      // one field of a record, read from one file
      const assemble = <T>(tree: T, record: { file: string }): T => {
        if (typeof tree !== 'object' || tree === null) return tree
        // the tables of contents are built again in the passes that place the record's
        // own text; the last one only adds documents plugins made
        if (!nodesOf(tree, 'include').length && (pass === 'last' || !hasToc(tree))) return tree
        const self = catalogue.idOf(record)
        const source = recordOrigin(record)
        const file = self ?? idOfFile(record.file)
        const origin = new WeakMap<object, IncludeOrigin>()
        seed(tree, origin)
        let node: T = assembleIncludes(tree, {
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
        return node
      }

      // two records of one reading share their tree, and a template is shared by every page
      const trees = new WeakMap<PodliteDocument, PodliteDocument>()
      const templates = new WeakMap<publishRecord, publishRecord>()
      const assembleTree = (record: publishRecord): PodliteDocument => {
        const known = trees.get(record.node)
        if (known) return known
        const made = assemble(record.node, record)
        trees.set(record.node, made)
        return made
      }
      const assembleTemplate = (template: publishRecord): publishRecord => {
        const known = templates.get(template)
        if (known) return known
        const node = assembleTree(template)
        const header = assemble(template.header, template)
        const footer = assemble(template.footer, template)
        const same = node === template.node && header === template.header && footer === template.footer
        const made = same ? template : { ...template, node, header, footer }
        templates.set(template, made)
        return made
      }

      const out = recs.map(record => {
        const node = assembleTree(record)
        const description = assemble(record.description, record)
        const header = assemble(record.header, record)
        const footer = assemble(record.footer, record)
        const template = record.template ? assembleTemplate(record.template) : record.template
        const same =
          node === record.node &&
          description === record.description &&
          header === record.header &&
          footer === record.footer &&
          template === record.template
        return same ? record : { ...record, node, description, header, footer, template }
      })

      if (pass !== 'first') {
        for (const record of out) {
          for (const tree of [record.node, record.description, record.header, record.footer, record.template?.node]) {
            for (const left of nodesOf(tree, 'include')) {
              if (left.location && told.has(left.location)) continue
              const file = left[nodeOriginKey]?.file ?? record.file
              const line = left.location ? `:${left.location.start.line}` : ''
              problems.push(`${shown(file)}${line}: the include is left in place`)
            }
            // a picture or a link placed now comes after the plugins that make them work
            for (const node of nodesOf(tree, () => true)) {
              const from = node[nodeOriginKey]?.file
              if (!from || !lateFiles.has(from)) continue
              const what =
                node.type === 'image' ? 'a picture' : node.type === 'fcode' && node.name === 'L' ? 'a link' : ''
              if (what) problems.push(`${shown(from)}: ${what} is placed after the plugins that handle it`)
            }
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

Gives the include plugin as two passes over one catalogue. C<first> goes before the
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
