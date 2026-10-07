import * as path from 'path'
import { publishRecord } from './record'
import { PodliteWebPlugin, PodliteWebPluginContext } from './plugins'
import {
  bindTarget,
  buildBindingIndex,
  getTextContentFromNode,
  indexAnchors,
  makeAttrs,
  makeInterator,
  PodNode,
  sameDocTarget,
  Text,
} from '@podlite/schema'
import type { Location } from '@podlite/schema'
import { convertFileLinksToUrl, getPathToOpen, isIndexed } from './node-utils'
import { nodeOrigin, recordOrigin } from './source'

/*
=begin pod :kind<export>

=head2 LinksOptions

C<documents> gives the files of the documents a name is found in, as the include
plugin finds them (C<includePasses> gives it): a C<doc:> link and an include
then read a name alike. Without it a name is looked for among the records at
hand. C<home> is the file of the home page: its address is C</> before the site
data plugin gives it.

=end pod
*/
export type LinksOptions = {
  // the files of the documents that answer to a name, as an include finds them;
  // without it, the records at hand that answer to it
  documents?: (name: string) => string[]
  // the file of the home page, whose address is given later in the chain
  home?: string
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
        // a name an include brought belongs to the document it was written in
        const from = nodeOrigin(node)?.file
        if (from !== undefined && path.resolve(from) !== fileOf(record)) return
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
    // the address a page gives a section, by the rule the page is drawn with: empty
    // for the block that names the document, which is the page itself
    const addressIn = (record: publishRecord, section: string): string | undefined => {
      const bindings = buildBindingIndex(record.node)
      const bound = bindTarget(section, bindings)
      if (bound.found && isNode(bound.node) && (bound.node.name === 'NAME' || bound.node.name === 'TITLE')) return ''
      return sameDocTarget(`#${section}`, { __bindings: bindings, __anchors: indexAnchors(record.node) })
    }
    const home = options.home === undefined ? undefined : path.resolve(options.home)
    const addressOf = (record: publishRecord): string =>
      record.publishUrl || (home !== undefined && path.resolve(record.file) === home ? '/' : '')
    // the title and the address a name links to: of one document, at the place a
    // search engine is told to index when it is published at more than one
    const resolve = (
      name: string,
      section: string | undefined,
      at: string,
    ): { title: string; url: string } | undefined => {
      // a link has no place of its own; `at` is where the paragraph holding it starts
      const written = section === undefined ? name : `${name}#${section}`
      const answering = (named.get(name) ?? []).filter(({ record }) => Boolean(addressOf(record)))
      const files = options.documents
        ? options.documents(name).map(file => path.resolve(file))
        : [...new Set(answering.map(({ record }) => fileOf(record)))]
      if (files.length > 1) {
        problems.push(
          `${at}: a link in the text from this line, doc:${written}: more than one document is named ${name}: ${files
            .map(shown)
            .join(', ')}`,
        )
        return undefined
      }
      const placed = answering.filter(({ record }) => fileOf(record) === files[0])
      if (!placed.length) {
        problems.push(
          `${at}: a link in the text from this line, doc:${written}: no published document is named ${name}`,
        )
        return undefined
      }
      const indexed = placed.filter(({ record }) => isIndexed(record))
      const { record, title } = (indexed.length ? indexed : placed)[(indexed.length ? indexed : placed).length - 1]
      const url = addressOf(record)
      if (section === undefined) return { title, url }
      // a section is the block the page gives that address to, by the rule the page is drawn with
      const anchor = addressIn(record, section)
      if (anchor === undefined) {
        problems.push(`${at}: a link in the text from this line, doc:${written}: ${name} has no section ${section}`)
        return undefined
      }
      return { title, url: `${url}${anchor}` }
    }

    const processNode = (node: PodNode, srcfile: string, page: publishRecord) => {
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
            const at = `${shown(from)}${line !== undefined ? `:${line}` : ''}`
            // a section of the document is addressed after its name, of this page without one
            const [name, ...section] = docLink.split('#')
            const local = (written: string) => {
              const anchor = addressIn(page, written)
              if (anchor !== undefined) return { title: written, url: anchor || '#' }
              problems.push(
                `${at}: a link in the text from this line, doc:#${written}: the page has no section ${written}`,
              )
              return undefined
            }
            const found =
              name === '' && section.length
                ? local(section.join('#'))
                : resolve(name, section.length ? section.join('#') : undefined, at)
            if (!found) return node
            const { url } = found
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
      const node = processNode(item.node, item.file, item)
      // process images inside description
      let extra = {} as { description?: PodNode; footer?: PodNode; header?: PodNode }
      if (item.description) {
        extra.description = processNode(item.description, item.file, item)
      }
      // process file header and footer
      const { footer, header } = item
      if (footer) {
        extra.footer = processNode(footer, item.file, item)
      }
      if (header) {
        extra.header = processNode(header, item.file, item)
      }
      return { ...item, node, ...extra }
    })
    if (problems.length) throw new LinkError([...new Set(problems)])

    return convertFileLinksToUrl(docToFileLinksConverted)
  }

  return [onProcess, onExit]
}

export default plugin
