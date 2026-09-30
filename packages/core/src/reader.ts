import { walkConfigScopes } from '@podlite/schema'
import type {
  AstTree,
  ConfigScope,
  Location,
  ParseDiagnostic,
  Podlite,
  PodliteDocument,
  ScopedBlock,
  RecognitionEvent,
  parseOpt,
} from '@podlite/schema'
import { parseMd } from '@podlite/markdown'

export type ReadFormat = 'podlite' | 'md'

export type ReaderOptions = {
  // the format a file of that name is read as; Podlite when not given
  format?: (file: string) => ReadFormat
  // whether the raw body of that block is Podlite text to be read in its place
  body?: (block: ScopedBlock) => boolean
}

type Parser = Pick<Podlite, 'parse' | 'toAst'>
type ReadExtras = Pick<parseOpt, 'recognition' | 'diagnostics'>

type Reader<T> = (text: string, file: string, config?: ConfigScope, extras?: ReadExtras) => T

type Point = Location['start']
type Place = (point: Point) => Point

// The raw body of a block as the parser holds it, when that is all the block holds
const rawBody = (block: any): string | undefined => {
  const content = block.content
  if (!Array.isArray(content) || !content.length) return undefined
  if (!content.every(part => part && part.type === 'verbatim' && typeof part.value === 'string')) return undefined
  return content.map(part => part.value).join('')
}

// Where the lines of a body stand in the text of its document. The parser cuts
// the start of a line and nothing else, so each line of the body ends a line of
// the document; the last one stands on the last line of the block before its
// closing marker. With a line that does not, there is no telling, and no answer.
const placeOf = (body: string, block: any, text: string): Place | undefined => {
  const end = block.location?.end
  if (!end) return undefined
  const lines = text.split('\n')
  const starts: number[] = []
  let offset = 0
  for (const line of lines) {
    starts.push(offset)
    offset += line.length + 1
  }
  const written = body.endsWith('\n') ? body.slice(0, -1).split('\n') : body.split('\n')
  // the last line the block takes, counted from one
  let last = end.column === 1 ? end.line - 1 : end.line
  const closing = new RegExp(`^\\s*=end\\s+${block.name}\\s*$`)
  if (closing.test(lines[last - 1] ?? '')) last--
  const first = last - written.length + 1
  if (first < 1) return undefined
  const cut: number[] = []
  for (let i = 0; i < written.length; i++) {
    const line = lines[first - 1 + i]
    if (line === undefined || !line.endsWith(written[i])) return undefined
    cut.push(line.length - written[i].length)
  }
  return point => {
    if (point.line > written.length) {
      // just past the body: the start of the line after it
      const line = Math.min(last + 1, lines.length)
      return { line, column: 1, offset: Math.min(starts[line - 1] ?? text.length, text.length) }
    }
    const line = first + point.line - 1
    const column = point.column + cut[point.line - 1]
    return { line, column, offset: starts[line - 1] + column - 1 }
  }
}

const placed = (location: Location, place: Place): Location => ({
  ...location,
  start: place(location.start),
  end: place(location.end),
})

const placeTree = (node: any, place: Place): void => {
  if (Array.isArray(node)) return node.forEach(child => placeTree(child, place))
  if (!node || typeof node !== 'object') return
  if (node.location?.start && node.location?.end) node.location = placed(node.location, place)
  placeTree(node.content, place)
}

/*
=begin pod :kind<export>

=head2 readerFor

Makes the reading an include assembly asks for out of a parser: a text, the name
of its file and the settings in effect where it is placed give a tree. The parser
keeps its own plugins. The fourth argument carries the lists the parser fills
with recognition events and diagnostics. With C<format>, a file the function names C<md> is read as
Markdown and comes back as the Markdown reader leaves it, without the plugins and
without the settings.

With C<body>, a block the function says yes to has its raw body read as Podlite
in its place: the blocks of the body become the content of the block, read with
the settings in effect where the block stands, and placed at their lines in the
text. Events and diagnostics of the body come with those of the document. A body
whose lines cannot be found in the text is left as it was. An include assembly
is to be given the same reader, so that the bodies of included files are read as
well.

=end pod
*/
export function readerFor(parser: Parser): Reader<PodliteDocument>
export function readerFor(parser: Parser, options: ReaderOptions): Reader<PodliteDocument | AstTree>
export function readerFor(parser: Parser, options: ReaderOptions = {}): Reader<PodliteDocument | AstTree> {
  const { format, body } = options
  const readBodies = (tree: any, text: string, config: ConfigScope, extras: ReadExtras, root: any): void =>
    walkConfigScopes(tree, config, (node, scope) => {
      const block: any = node
      if (block.name === 'root' || !body!(node)) return
      const raw = rawBody(block)
      if (raw === undefined) return
      const place = placeOf(raw, block, text)
      if (!place) return
      const here = { ...scope }
      const recognition: RecognitionEvent[] = []
      const diagnostics: ParseDiagnostic[] = []
      const read: any = parser.toAst(parser.parse(raw, { podMode: 1, config: here, recognition, diagnostics }), {
        config: here,
      })
      placeTree(read.content, place)
      const told: ParseDiagnostic[] = Array.isArray(read.diagnostics) ? read.diagnostics : diagnostics
      const warnings = told.map(item => ({ ...item, location: placed(item.location, place) }))
      if (warnings.length) {
        // the list the caller gave is the one the root holds once it is not empty
        const list: ParseDiagnostic[] = extras.diagnostics ?? root.diagnostics ?? []
        list.push(...warnings)
        root.diagnostics = list
      }
      extras.recognition?.push(...recognition.map(event => ({ ...event, location: placed(event.location, place) })))
      // a body inside is found from its place in the text, as this one was
      readBodies(read.content, text, here, extras, root)
      block.content = read.content
    })
  return (text, file, config, extras = {}) => {
    if (format?.(file) === 'md') return parseMd(text)
    const tree = parser.toAst(parser.parse(text, { ...extras, podMode: 1, config }), { config })
    if (body) readBodies(tree, text, config ?? {}, extras, tree)
    return tree
  }
}
