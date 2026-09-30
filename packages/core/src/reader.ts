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

// Where the characters of a body stand in the text of its document. The parser
// cuts the indent at the start of a line and nothing else, so the body read
// backwards from where it ends is the text read backwards with runs of spaces
// and tabs left out. A body that is not, has no place, and there is no answer.
const placeOf = (body: string, block: any, text: string): Place | undefined => {
  const from = block.location?.start?.offset
  const to = block.location?.end?.offset
  if (typeof from !== 'number' || typeof to !== 'number') return undefined
  // a delimited block ends with its closing marker, the other forms with their body
  const closing = new RegExp(`[ \\t]*=end[ \\t]+${block.name}[ \\t]*(\\r\\n|\\n|\\r)?$`)
  const within = text.slice(0, to)
  const end = within.length - (closing.exec(within)?.[0].length ?? 0)
  const at: number[] = new Array(body.length + 1)
  at[body.length] = end
  let offset = end
  for (let i = body.length - 1; i >= 0; i--) {
    offset--
    while (offset >= from && text[offset] !== body[i] && (text[offset] === ' ' || text[offset] === '\t')) offset--
    if (offset < from || text[offset] !== body[i]) return undefined
    at[i] = offset
  }
  return point => {
    const offset = at[Math.min(Math.max(point.offset, 0), body.length)]
    // lines are counted the way the parser counts them
    const lineStart = text.lastIndexOf('\n', offset - 1) + 1
    let line = 1
    for (let i = text.indexOf('\n'); i !== -1 && i < offset; i = text.indexOf('\n', i + 1)) line++
    return { line, column: offset - lineStart + 1, offset }
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
