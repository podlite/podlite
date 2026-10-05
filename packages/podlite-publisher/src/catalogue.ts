/*
=begin pod :kind<module>

=head2 catalogue

The texts an include on a site can bring: the records the site read before the
plugins ran, and the documents plugins make on the way. One reading is one
source, whatever number of records hold it: the current version of a document
and its permanent address are one source, a page cut out of a file is that file.

The id of a source is the absolute path of the file it was read from; a
document a plugin makes is known by the name it was made under, resolved the
same way. A path written in a C<file:> source is resolved from the directory of
the file it is written in, a mask is matched against the files of the
catalogue, and a C<doc:> source is the document whose C<=NAME> or C<=TITLE>
answers to the name. A name two sources answer to resolves to neither, and the
answer names both.

=end pod
*/
import * as path from 'path'
import matter from 'gray-matter'
import { filePathMatches, getDocIDs } from '@podlite/schema'
import { formatOfFile, formatOfType } from 'podlite'
import type { Located, Source, Sources } from 'podlite'
import { getParserTypeforFile, PARSER_TYPES } from './node-utils'
import { isParsedTree, recordOrigin, recordSource } from './source'
import type { RecordSource } from './source'

const isMask = (written: string): boolean => /[*?]/.test(written)

const isUnder = (file: string, dir: string): boolean => {
  const relative = path.relative(dir, file)
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}

type Entry = {
  id: string
  source: RecordSource
  // the tree the text was read into, when a record holds it as read
  tree?: unknown
}

export type CatalogueOptions = {
  // directories a path written inside one of them does not lead out of
  bounds?: string[]
  // the tree of a text, for the names a document answers to
  parse?: (text: string, file: string) => unknown
}

export type Catalogue = {
  sources: Sources
  // takes in the readings of records it does not hold yet
  add: (records: object[]) => void
  // the id of the file a record was read from, or cut out of
  idOf: (record: object) => string | undefined
}

export const idOfFile = (file: string): string => path.resolve(file)

// a Markdown text is read without its front matter, as the record was
const textOf = (source: RecordSource): string =>
  getParserTypeforFile(source.file, source.mime) === PARSER_TYPES.MARKDOWN ? matter(source.text).content : source.text

export const catalogueOf = (records: object[] = [], options: CatalogueOptions = {}): Catalogue => {
  const entries = new Map<string, Entry>()
  const held = new WeakSet<RecordSource>()
  const bounds = (options.bounds ?? []).map(dir => path.resolve(dir))
  let names: Map<string, string[]> | undefined

  const add = (list: object[]) => {
    for (const record of list) {
      const source = recordOrigin(record)
      if (!source || held.has(source)) continue
      held.add(source)
      const id = idOfFile(source.file)
      if (entries.has(id)) continue
      const own = recordSource(record) === source && isParsedTree(record)
      entries.set(id, { id, source, tree: own ? (record as { node?: unknown }).node : undefined })
      names = undefined
    }
  }

  // the names each document answers to, built on the first question
  const namesOf = (): Map<string, string[]> => {
    if (names) return names
    names = new Map()
    for (const entry of entries.values()) {
      const tree = entry.tree ?? options.parse?.(textOf(entry.source), entry.source.file)
      if (!tree) continue
      for (const name of new Set(getDocIDs({ file: entry.source.file, node: tree as any }))) {
        names.set(name, [...(names.get(name) ?? []), entry.id])
      }
    }
    return names
  }

  // the directory a path written in that place does not lead out of
  const boundOf = (dir: string): string | undefined =>
    bounds.filter(bound => dir === bound || isUnder(dir, bound)).sort((a, b) => b.length - a.length)[0]

  const sourceAt = (id: string, name: string): Source => {
    const entry = entries.get(id)
    const format = entry?.source.mime ? formatOfType(entry.source.mime) : formatOfFile(id)
    return { id, name, context: path.dirname(id), ...(format ? { format } : {}) }
  }

  const locateFile = (written: string, context: unknown, plain?: boolean): Located => {
    const dir = path.resolve(String(context ?? ''))
    const bound = boundOf(dir)
    const inside = (id: string) => bound === undefined || isUnder(id, bound)
    if (plain || !isMask(written)) {
      const id = path.resolve(dir, written)
      if (!inside(id)) return { masked: false, sources: [], failed: `the path leads out of ${bound}` }
      return { masked: false, sources: [sourceAt(id, written)] }
    }
    const pattern = path.resolve(dir, written)
    const found = [...entries.keys()].filter(id => inside(id) && filePathMatches(id, pattern)).sort()
    return {
      masked: true,
      // named the way the mask is written, for the selection to match it back
      sources: found.map(id => sourceAt(id, path.isAbsolute(written) ? id : path.relative(dir, id))),
    }
  }

  const locateDoc = (written: string): Located => {
    const ids = namesOf().get(written) ?? []
    if (ids.length > 1) {
      const files = ids.map(id => entries.get(id)!.source.file).join(', ')
      return { masked: false, sources: [], failed: `more than one document is named ${written}: ${files}` }
    }
    return { masked: false, sources: ids.map(id => ({ ...sourceAt(id, written) })) }
  }

  const sources: Sources = {
    schemes: ['file', 'doc'],
    locate: (written, context, plain, _at, scheme) =>
      scheme === 'doc' ? locateDoc(written) : locateFile(written, context, plain),
    read: source => {
      const entry = entries.get(source.id)
      return entry ? textOf(entry.source) : null
    },
  }

  const idOf = (record: object): string | undefined => {
    const source = recordOrigin(record)
    return source ? idOfFile(source.file) : undefined
  }

  add(records)
  return { sources, add, idOf }
}
