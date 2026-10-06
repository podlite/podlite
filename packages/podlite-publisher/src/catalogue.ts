/*
=begin pod :kind<module>

=head2 catalogue

This module holds the texts an include on a site can bring. They are the
records the site read before the plugins ran, and the documents plugins make
later in the chain. Several records read from one file are one source. The
current version of a document and its permanent address are one source. A page
cut out of a file is that file.

The id of a source is the absolute path of the file it was read from. A
document a plugin makes is known by the name it was made under, resolved the
same way.

A path in a C<file:> source is resolved from the directory of the file it is
written in. A mask is matched against the files of the catalogue. A C<doc:>
source is the document whose C<=NAME> or C<=TITLE> answers to the name. When two
sources answer to a name, it resolves to neither, and the answer names both.
When no document answers to a name yet and the host says it will be made later,
an include of it is left for a later pass.

=end pod
*/
import * as path from 'path'
import matter from 'gray-matter'
import { filePathMatches, getDocIDs, mkRootBlock } from '@podlite/schema'
import type { AstTree, PodliteDocument } from '@podlite/schema'
import { formatOfFile, formatOfType } from 'podlite'
import type { Located, Source, Sources } from 'podlite'
import { getParserTypeforFile, PARSER_TYPES } from './node-utils'
import { publishRecord } from './record'
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
  tree?: PodliteDocument | AstTree
}

/*
=begin pod :kind<export>

=head2 CatalogueOptions

C<bounds> are directories a path written inside one of them may not lead out of.
C<parse> reads a text whose record does not hold its tree as read, for the names
the document answers to. C<waits> says a name no document answers to yet will be
made later.

=end pod
*/
export type CatalogueOptions = {
  // directories a path written inside one of them does not lead out of
  bounds?: string[]
  // the tree of a text, for the names a document answers to
  parse?: (text: string, file: string) => PodliteDocument | AstTree
  // whether a name no document answers to yet is to be waited for: an include of
  // it is then left in place
  waits?: (name: string) => boolean
}

/*
=begin pod :kind<export>

=head2 Catalogue

C<sources> is what the assembler of C<podlite> reads included texts from.

=end pod
*/
export type Catalogue = {
  sources: Sources
  // takes in the readings of records it does not hold yet
  add: (records: publishRecord[]) => void
  // the id of the file a record was read from, or cut out of
  idOf: (record: object) => string | undefined
  // the ids of the documents that answer to a name
  named: (name: string) => string[]
  // the text of a source as an include reads it
  textOf: (id: string) => string | undefined
}

/*
=begin pod :kind<export>

=head2 idOfFile

The id of a file as a source: its absolute path, from the working directory.

=end pod
*/
export const idOfFile = (file: string): string => path.resolve(file)

// a Markdown text is read without its front matter, as the record was
const readable = (source: RecordSource): string =>
  getParserTypeforFile(source.file, source.mime) === PARSER_TYPES.MARKDOWN ? matter(source.text).content : source.text

/*
=begin pod :kind<export>

=head2 catalogueOf

A catalogue over the readings of the records given. Records added later bring
the readings it does not hold; a reading it holds already is not taken twice.

=end pod
*/
export const catalogueOf = (records: publishRecord[] = [], options: CatalogueOptions = {}): Catalogue => {
  const entries = new Map<string, Entry>()
  const held = new WeakSet<RecordSource>()
  const bounds = (options.bounds ?? []).map(dir => path.resolve(dir))
  let names: Map<string, string[]> | undefined

  const add = (list: publishRecord[]) => {
    for (const record of list) {
      const source = recordOrigin(record)
      if (!source || held.has(source)) continue
      held.add(source)
      const id = idOfFile(source.file)
      if (entries.has(id)) continue
      const own = recordSource(record) === source && isParsedTree(record)
      const entry = { id, source, tree: own ? record.node : undefined }
      entries.set(id, entry)
      if (names) index(names, entry)
    }
  }

  const index = (into: Map<string, string[]>, entry: Entry) => {
    const tree = entry.tree ?? options.parse?.(readable(entry.source), entry.source.file)
    if (!tree) return
    const node = Array.isArray(tree) ? mkRootBlock({}, tree) : tree
    for (const name of new Set(getDocIDs({ file: entry.source.file, node }))) {
      into.set(name, [...(into.get(name) ?? []), entry.id])
    }
  }

  // the names each document answers to, built on the first question
  const namesOf = (): Map<string, string[]> => {
    if (names) return names
    names = new Map()
    for (const entry of entries.values()) index(names, entry)
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
      if (!inside(id))
        return {
          masked: false,
          sources: [],
          failed: `the path leads out of ${path.relative(process.cwd(), bound) || '.'}`,
        }
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

  const locateDoc = (written: string): Located | undefined => {
    const ids = namesOf().get(written) ?? []
    if (!ids.length && options.waits?.(written)) return undefined
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
      return entry ? readable(entry.source) : null
    },
  }

  const idOf = (record: object): string | undefined => {
    const source = recordOrigin(record)
    return source ? idOfFile(source.file) : undefined
  }

  const named = (name: string): string[] => namesOf().get(name) ?? []
  const textOf = (id: string): string | undefined => {
    const entry = entries.get(id)
    return entry ? readable(entry.source) : undefined
  }

  add(records)
  return { sources, add, idOf, named, textOf }
}
