import * as path from 'path'
import { publishRecord } from './record'
import { PodliteWebPlugin, PodliteWebPluginContext } from './plugins'
import { getTextContentFromNode, makeAttrs, makeInterator, PodNode, Text, toFragment } from '@podlite/schema'
import type { Location } from '@podlite/schema'
import { convertFileLinksToUrl, getPathToOpen, isIndexed } from './node-utils'
import { nodeOrigin, recordOrigin } from './source'

/*
=begin pod :kind<export>

=head2 LinksOptions

C<documents> gives the files of the documents a name is found in, as the include
plugin finds them (C<includePasses> gives it): a C<doc:> link and an include
then read a name alike. Without it a name is looked for among the records at
hand.

=end pod
*/
export type LinksOptions = {
  // the files of the documents that answer to a name, as an include finds them;
  // without it, the records at hand that answer to it
  documents?: (name: string) => string[]
}

/*
=begin pod :kind<export>

=head2 LinkError

A C<doc:> link whose name no published document answers to, or that two
documents answer to, stops the build. C<problems> holds one line for each.

=end pod
*/
export class LinkError extends Error {
  readonly problems: string[]
  constructor(problems: string[]) {
    super(`a link does not resolve:\n${problems.map(line => `  ${line}`).join('\n')}`)
    this.name = 'LinkError'
    this.problems = problems
  }
}

type TreeNode = { type?: string; name?: string; content?: unknown; location?: Location }

const isNode = (value: unknown): value is TreeNode =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const shown = (file: string): string => (path.isAbsolute(file) ? path.relative(process.cwd(), file) : file)

// the file a record was read from, or cut out of
const fileOf = (record: publishRecord): string => path.resolve(recordOrigin(record)?.file ?? record.file)

const plugin = (options: LinksOptions = {}): PodliteWebPlugin => {
  const outCtx: PodliteWebPluginContext = {}
  const onExit = ctx => ({ ...ctx, ...outCtx })
  const onProcess = (recs: publishRecord[]) => {
    // the records that answer to each name, with the text of the block that names them
    const named = new Map<string, Array<{ record: publishRecord; title: string }>>()
    for (const record of recs) {
      const handler = node => {
        const conf = makeAttrs(node, {})
        const title = getTextContentFromNode(node).trim()
        const id = conf.exists('id') ? conf.getFirstValue('id') : undefined
        for (const name of new Set([id, title].filter(Boolean))) {
          named.set(name, [...(named.get(name) ?? []), { record, title }])
        }
      }
      makeInterator({ NAME: handler, TITLE: handler })(record.node, {})
    }

    const problems: string[] = []
    // the title and the address a name links to: of one document, at the place a
    // search engine is told to index when it is published at more than one
    const resolve = (name: string, at: string): { title: string; url: publishRecord['publishUrl'] } | undefined => {
      // a link has no place of its own; `at` is where the paragraph holding it starts
      const answering = named.get(name) ?? []
      const files = options.documents
        ? options.documents(name).map(file => path.resolve(file))
        : [...new Set(answering.map(({ record }) => fileOf(record)))]
      if (files.length > 1) {
        problems.push(
          `${at}: a link in the text from this line, doc:${name}: more than one document is named ${name}: ${files
            .map(shown)
            .join(', ')}`,
        )
        return undefined
      }
      const placed = answering.filter(({ record }) => fileOf(record) === files[0])
      if (!placed.length) {
        problems.push(`${at}: a link in the text from this line, doc:${name}: no published document is named ${name}`)
        return undefined
      }
      const indexed = placed.filter(({ record }) => isIndexed(record))
      const { record, title } = (indexed.length ? indexed : placed)[(indexed.length ? indexed : placed).length - 1]
      return { title, url: record.publishUrl }
    }

    const processNode = (node: PodNode, srcfile: string) => {
      // the line the paragraph or block holding each link starts at
      const lines = new WeakMap<object, number>()
      const mark = (tree: unknown, line?: number) => {
        if (Array.isArray(tree)) return tree.forEach(child => mark(child, line))
        if (!isNode(tree)) return
        const here = (tree.type === 'block' || tree.type === 'para') && tree.location ? tree.location.start.line : line
        if (tree.type === 'fcode' && tree.name === 'L' && here !== undefined) lines.set(tree, here)
        mark(tree.content, here)
      }
      mark(node)
      const rules = {
        'L<>': node => {
          const { content, meta } = node
          const link = meta ? meta : getTextContentFromNode(content)

          const r = link.match(/doc:\s*(?<path>(.+))\s*$/)
          if (r?.groups?.path) {
            const docLink = r.groups.path
            const from = nodeOrigin(node)?.file ?? srcfile
            const { isRemote } = getPathToOpen(docLink, from)
            if (isRemote) {
              return node
            }
            const line = lines.get(node)
            // a section of the document is addressed after its name
            const [name, ...section] = docLink.split('#')
            const found = resolve(name, `${shown(from)}${line !== undefined ? `:${line}` : ''}`)
            if (!found) return node
            const url = section.length ? `${found.url}#${toFragment(section.join('#'))}` : found.url
            const newContent: Text = {
              type: 'text',
              value: `${found.title}`,
            }
            const updated = meta ? { meta: url } : { content: newContent, meta: url }

            return { ...node, ...updated }
          }
          return node
        },
      }
      return makeInterator(rules)(node, {})
    }
    // convert all doc: links to file:: links
    const docToFileLinksConverted = recs.map(item => {
      const node = processNode(item.node, item.file)
      // process images inside description
      let extra = {} as { description?: PodNode; footer?: PodNode; header?: PodNode }
      if (item.description) {
        extra.description = processNode(item.description, item.file)
      }
      // process file header and footer
      const { footer, header } = item
      if (footer) {
        extra.footer = processNode(footer, item.file)
      }
      if (header) {
        extra.header = processNode(header, item.file)
      }
      return { ...item, node, ...extra }
    })
    if (problems.length) throw new LinkError([...new Set(problems)])

    return convertFileLinksToUrl(docToFileLinksConverted)
  }

  return [onProcess, onExit]
}

export default plugin
